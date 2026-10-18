package vn.edu.bentre.eclass;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;

import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.browser.customtabs.CustomTabsService;
import androidx.browser.customtabs.CustomTabsServiceConnection;
import androidx.browser.customtabs.CustomTabsSession;
import androidx.browser.trusted.TrustedWebActivityIntent;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/**
 * Opens the website in a real browser. Entry points, service callbacks, and
 * activity launches run on the main thread. Session IPC runs off it so a broken
 * browser cannot prevent the activity's visible loading timeout from firing.
 */
final class AndroidBrowserHandoff implements BrowserHandoff {
    // Resolve an unrelated HTTPS URL: resolving our own URL could select this
    // app's verified link and open the launcher again instead of a browser.
    private static final Uri BROWSER_PROBE = Uri.parse("https://www.example.com/");
    private static final String CHROME_PACKAGE = "com.android.chrome";
    // A hung vendor Binder call cannot always be interrupted. Keep the process
    // bounded at two workers, with no queue; later attempts use browser fallback.
    private static final ThreadPoolExecutor SESSION_WORKERS = new ThreadPoolExecutor(
            0, 2, 30, TimeUnit.SECONDS, new SynchronousQueue<>(), runnable -> {
                Thread thread = new Thread(runnable, "eclass-browser-session");
                thread.setDaemon(true);
                return thread;
            }, new ThreadPoolExecutor.AbortPolicy());

    private final Activity activity;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private volatile long generation;
    private volatile PendingConnection connection;

    AndroidBrowserHandoff(Activity activity) {
        this.activity = activity;
    }

    @Override
    public void openTrusted(Uri target, Runnable onOpened, Runnable onUnavailable) {
        cancel();
        if (!canLaunch() || !isHttps(target)) {
            onUnavailable.run();
            return;
        }

        Browser browser = null;
        for (Browser candidate : findBrowsers()) {
            if (hasCustomTabsService(candidate)) {
                browser = candidate;
                break;
            }
        }
        if (browser == null) {
            onUnavailable.run();
            return;
        }

        PendingConnection pending = new PendingConnection(
                generation, browser, target, onOpened, onUnavailable);
        connection = pending;
        try {
            boolean bound = CustomTabsClient.bindCustomTabsService(
                    activity, browser.packageName, pending);
            pending.bound = bound;
            // Some browser/test implementations invoke a failure callback from
            // bindService itself. That callback may also reenter cancel().
            if (!isCurrent(pending)) {
                unbind(pending);
            } else if (!bound) {
                unavailable(pending);
            }
        } catch (RuntimeException browserProblem) {
            unavailable(pending);
        }
    }

    @Override
    public boolean openBrowser(Uri target) {
        cancel();
        if (!canLaunch() || !isHttps(target)) {
            return false;
        }
        for (Browser browser : findBrowsers()) {
            // This Custom Tab is deliberately unbound: the fallback must not
            // wait for the same browser service that caused the timeout.
            try {
                CustomTabsIntent tab = new CustomTabsIntent.Builder()
                        .setShowTitle(true)
                        .build();
                tab.intent.setPackage(browser.packageName);
                tab.launchUrl(activity, target);
                return true;
            } catch (RuntimeException browserProblem) {
                // A browser may not accept Custom Tab extras. Try its regular
                // web activity before moving to another installed browser.
            }
            try {
                Intent view = new Intent(Intent.ACTION_VIEW, target)
                        .addCategory(Intent.CATEGORY_BROWSABLE)
                        .setComponent(browser.component);
                activity.startActivity(view);
                return true;
            } catch (RuntimeException browserProblem) {
                // Removed, disabled, or unavailable browsers are recoverable.
            }
        }
        return false;
    }

    @Override
    public void cancel() {
        ++generation;
        PendingConnection previous = connection;
        connection = null;
        if (previous != null) {
            unbind(previous);
        }
    }

    private boolean canLaunch() {
        return !activity.isFinishing() && !activity.isDestroyed();
    }

    private static boolean isHttps(Uri target) {
        return target != null
                && "https".equalsIgnoreCase(target.getScheme())
                && target.getHost() != null
                && target.getUserInfo() == null;
    }

    private boolean isCurrent(PendingConnection pending) {
        return connection == pending && pending.generation == generation;
    }

    private void unavailable(PendingConnection pending) {
        if (!isCurrent(pending) || pending.completed) {
            return;
        }
        pending.completed = true;
        // Invalidate before the callback: the activity can immediately start a
        // browser fallback, retry, or destroy its view from onUnavailable.
        cancel();
        pending.onUnavailable.run();
    }

    private void lostConnection(PendingConnection pending) {
        if (!isCurrent(pending)) {
            return;
        }
        if (pending.completed) {
            // The browser has already opened. A later service disconnect must
            // never launch a second browser or replace the successful result.
            cancel();
        } else {
            unavailable(pending);
        }
    }

    private void unbind(PendingConnection pending) {
        if (pending.sessionRequest != null) {
            pending.sessionRequest.cancel(true);
            pending.sessionRequest = null;
        }
        if (!pending.bound) {
            return;
        }
        pending.bound = false;
        try {
            activity.unbindService(pending);
        } catch (IllegalArgumentException | SecurityException alreadyDisconnected) {
            // Android may already have removed a dead browser's connection.
        }
    }

    private void createSession(PendingConnection pending, CustomTabsClient client) {
        try {
            pending.sessionRequest = SESSION_WORKERS.submit(() -> {
                if (!isCurrent(pending) || Thread.currentThread().isInterrupted()) {
                    return;
                }
                CustomTabsSession session;
                try {
                    session = client.newSession(null);
                } catch (RuntimeException browserProblem) {
                    session = null;
                }
                if (!isCurrent(pending) || Thread.currentThread().isInterrupted()) {
                    return;
                }
                CustomTabsSession result = session;
                mainHandler.post(() -> finishSession(pending, result));
            });
        } catch (RejectedExecutionException busyBrowserWorkers) {
            unavailable(pending);
        }
    }

    private void finishSession(PendingConnection pending, CustomTabsSession session) {
        if (!isCurrent(pending) || pending.completed) {
            return;
        }
        if (session == null || !canLaunch()) {
            unavailable(pending);
            return;
        }
        try {
            TrustedWebActivityIntent trusted = new TrustedWebActivityIntentBuilder(pending.target)
                    .build(session);
            trusted.getIntent().setPackage(pending.browser.packageName);
            trusted.launchTrustedWebActivity(activity);
        } catch (RuntimeException browserProblem) {
            unavailable(pending);
            return;
        }
        if (isCurrent(pending)) {
            pending.completed = true;
            pending.onOpened.run();
        }
    }

    @SuppressWarnings("deprecation")
    private List<Browser> findBrowsers() {
        List<Browser> ordered = new ArrayList<>();
        try {
            PackageManager packages = activity.getPackageManager();
            Intent probe = new Intent(Intent.ACTION_VIEW, BROWSER_PROBE)
                    .addCategory(Intent.CATEGORY_BROWSABLE);
            Map<String, Browser> candidates = new LinkedHashMap<>();
            for (ResolveInfo result : packages.queryIntentActivities(
                    probe, PackageManager.MATCH_DEFAULT_ONLY)) {
                ActivityInfo info = result.activityInfo;
                if (isUsableBrowser(info)) {
                    candidates.putIfAbsent(info.packageName,
                            new Browser(info.packageName,
                                    new ComponentName(info.packageName, info.name)));
                }
            }

            ResolveInfo defaultResult = packages.resolveActivity(
                    probe, PackageManager.MATCH_DEFAULT_ONLY);
            if (defaultResult != null && isUsableBrowser(defaultResult.activityInfo)) {
                addBrowser(ordered, candidates.remove(defaultResult.activityInfo.packageName));
            }
            addBrowser(ordered, candidates.remove(CHROME_PACKAGE));
            ordered.addAll(candidates.values());
        } catch (RuntimeException unavailablePackageManager) {
            // Show the launcher's recovery screen instead of crashing it.
        }
        return ordered;
    }

    private static void addBrowser(List<Browser> ordered, Browser browser) {
        if (browser != null) {
            ordered.add(browser);
        }
    }

    private boolean isUsableBrowser(ActivityInfo info) {
        return info != null
                && info.packageName != null
                && info.name != null
                && !activity.getPackageName().equals(info.packageName)
                && info.enabled
                && info.exported
                && info.applicationInfo != null
                && info.applicationInfo.enabled
                && (info.permission == null
                    || activity.checkSelfPermission(info.permission)
                        == PackageManager.PERMISSION_GRANTED);
    }

    @SuppressWarnings("deprecation")
    private boolean hasCustomTabsService(Browser browser) {
        try {
            Intent service = new Intent(CustomTabsService.ACTION_CUSTOM_TABS_CONNECTION)
                    .setPackage(browser.packageName);
            ResolveInfo result = activity.getPackageManager().resolveService(service, 0);
            ServiceInfo info = result == null ? null : result.serviceInfo;
            return info != null
                    && browser.packageName.equals(info.packageName)
                    && info.enabled
                    && info.exported
                    && info.applicationInfo != null
                    && info.applicationInfo.enabled
                    && (info.permission == null
                        || activity.checkSelfPermission(info.permission)
                            == PackageManager.PERMISSION_GRANTED);
        } catch (RuntimeException unavailableBrowser) {
            return false;
        }
    }

    private static final class Browser {
        final String packageName;
        final ComponentName component;

        Browser(String packageName, ComponentName component) {
            this.packageName = packageName;
            this.component = component;
        }
    }

    private final class PendingConnection extends CustomTabsServiceConnection {
        final long generation;
        final Browser browser;
        final Uri target;
        final Runnable onOpened;
        final Runnable onUnavailable;
        boolean bound;
        boolean launchStarted;
        boolean completed;
        Future<?> sessionRequest;

        PendingConnection(long generation, Browser browser, Uri target,
                Runnable onOpened, Runnable onUnavailable) {
            this.generation = generation;
            this.browser = browser;
            this.target = target;
            this.onOpened = onOpened;
            this.onUnavailable = onUnavailable;
        }

        @Override
        public void onCustomTabsServiceConnected(ComponentName name, CustomTabsClient client) {
            if (!isCurrent(this) || completed || launchStarted) {
                return;
            }
            if (!canLaunch() || name == null
                    || !browser.packageName.equals(name.getPackageName())) {
                unavailable(this);
                return;
            }
            launchStarted = true;
            createSession(this, client);
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            lostConnection(this);
        }

        @Override
        public void onNullBinding(ComponentName name) {
            lostConnection(this);
        }

        @Override
        public void onBindingDied(ComponentName name) {
            lostConnection(this);
        }
    }
}
