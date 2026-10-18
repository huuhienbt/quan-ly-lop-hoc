package vn.edu.bentre.eclass;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNotSame;
import static org.junit.Assert.assertTrue;
import static org.robolectric.Shadows.shadowOf;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.pm.ActivityInfo;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.ResolveInfo;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.Binder;
import android.os.Bundle;
import android.os.Looper;
import android.support.customtabs.ICustomTabsService;

import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsService;
import androidx.browser.customtabs.CustomTabsServiceConnection;

import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BooleanSupplier;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.LooperMode;
import org.robolectric.util.ReflectionHelpers;
import org.robolectric.util.ReflectionHelpers.ClassParameter;

/** Tests real adapter selection, raw service callbacks, and asynchronous session completion. */
@RunWith(org.robolectric.RobolectricTestRunner.class)
@Config(sdk = {26, 36})
@LooperMode(LooperMode.Mode.PAUSED)
public class AndroidBrowserHandoffTest {
    private static final String BROWSER = "org.example.browser";
    private static final ComponentName SERVICE = new ComponentName(BROWSER, BROWSER + ".TabsService");
    private static final Uri HOME = Uri.parse("https://e-class-vinhlong.vercel.app/");
    private static final Uri PROBE = Uri.parse("https://www.example.com/");

    private ActivityController<BrowserTestActivity> controller;
    private BrowserTestActivity activity;
    private AndroidBrowserHandoff handoff;
    private final AtomicInteger opened = new AtomicInteger();
    private final AtomicInteger unavailable = new AtomicInteger();

    @Before
    public void setUp() {
        controller = Robolectric.buildActivity(BrowserTestActivity.class).create().start().resume();
        activity = controller.get();
        handoff = new AndroidBrowserHandoff(activity);
    }

    @After
    public void cleanUp() {
        handoff.cancel();
        controller.pause().stop().destroy();
        shadowOf(Looper.getMainLooper()).idle();
    }

    @Test
    public void noBrowserReportsFailureWithoutLaunchingOwnApp() {
        registerBrowser(activity.getPackageName(), true);

        handoff.openTrusted(HOME, opened::incrementAndGet, unavailable::incrementAndGet);

        assertEquals(1, unavailable.get());
        assertEquals(0, activity.bindCalls);
        assertFalse(handoff.openBrowser(HOME));
        assertTrue(activity.started.isEmpty());
    }

    @Test
    public void fallbackNeedsNoServiceAndExplicitlyTargetsRealBrowser() {
        registerBrowser(activity.getPackageName(), true);
        registerBrowser(BROWSER, false);

        assertTrue(handoff.openBrowser(HOME));

        assertEquals(0, activity.bindCalls);
        assertEquals(1, activity.started.size());
        Intent launched = activity.started.get(0);
        assertEquals(BROWSER, launched.getPackage());
        assertEquals(HOME, launched.getData());
        assertFalse(activity.getPackageName().equals(launched.getPackage()));
    }

    @Test
    public void rejectedCustomTabFallsBackToExplicitBrowserActivity() {
        registerBrowser(BROWSER, false);
        activity.rejectStarts = 1;

        assertTrue(handoff.openBrowser(HOME));

        assertEquals(2, activity.started.size());
        Intent plain = activity.started.get(1);
        assertEquals(Intent.ACTION_VIEW, plain.getAction());
        assertEquals(new ComponentName(BROWSER, BROWSER + ".WebActivity"), plain.getComponent());
        assertEquals(HOME, plain.getData());
    }

    @Test
    public void falseBindReportsUnavailableOnceAndLateConnectionCannotLaunch() {
        registerBrowser(BROWSER, true);
        activity.bindResult = false;
        AtomicInteger sessions = new AtomicInteger();

        handoff.openTrusted(HOME, opened::incrementAndGet, unavailable::incrementAndGet);
        CustomTabsServiceConnection old = (CustomTabsServiceConnection) activity.lastConnection;
        assertNotNull(old);
        old.onCustomTabsServiceConnected(SERVICE, client(true, sessions, null, null, null));
        nullBinding(old);
        old.onBindingDied(SERVICE);

        assertEquals(1, unavailable.get());
        assertEquals(0, opened.get());
        assertEquals(0, sessions.get());
        assertTrue(activity.started.isEmpty());
    }

    @Test
    public void eachRawConnectionFailureReportsOnceAndUnbinds() {
        registerBrowser(BROWSER, true);
        for (int failure = 0; failure < 3; failure++) {
            handoff.openTrusted(HOME, opened::incrementAndGet, unavailable::incrementAndGet);
            ServiceConnection connection = activity.lastConnection;
            if (failure == 0) nullBinding(connection);
            else if (failure == 1) connection.onBindingDied(SERVICE);
            else connection.onServiceDisconnected(SERVICE);
            nullBinding(connection);
            connection.onBindingDied(SERVICE);
            connection.onServiceDisconnected(SERVICE);
            assertEquals(failure + 1, unavailable.get());
            assertEquals(failure + 1, activity.unbindCalls);
        }
        assertEquals(0, opened.get());
        assertTrue(activity.started.isEmpty());
    }

    @Test
    public void reentrantFailureDuringBindStillUnbindsAfterBindReturnsTrue() {
        registerBrowser(BROWSER, true);
        activity.failDuringBind = true;

        handoff.openTrusted(HOME, opened::incrementAndGet, unavailable::incrementAndGet);

        assertEquals(1, unavailable.get());
        assertEquals(1, activity.unbindCalls);
        assertTrue(activity.started.isEmpty());
    }

    @Test
    public void cancellingStalledBindingMakesEveryLateCallbackInert() {
        registerBrowser(BROWSER, true);
        AtomicInteger sessions = new AtomicInteger();
        handoff.openTrusted(HOME, opened::incrementAndGet, unavailable::incrementAndGet);
        CustomTabsServiceConnection old = (CustomTabsServiceConnection) activity.lastConnection;

        handoff.cancel();
        old.onCustomTabsServiceConnected(SERVICE, client(true, sessions, null, null, null));
        nullBinding(old);
        old.onServiceDisconnected(SERVICE);
        old.onBindingDied(SERVICE);
        shadowOf(Looper.getMainLooper()).idle();

        assertEquals(1, activity.unbindCalls);
        assertEquals(0, sessions.get());
        assertEquals(0, opened.get());
        assertEquals(0, unavailable.get());
        assertTrue(activity.started.isEmpty());
    }

    @Test
    public void nullSessionCompletesAsUnavailableWithoutOpeningActivity() throws Exception {
        registerBrowser(BROWSER, true);
        AtomicInteger sessions = new AtomicInteger();
        handoff.openTrusted(HOME, opened::incrementAndGet, unavailable::incrementAndGet);

        ((CustomTabsServiceConnection) activity.lastConnection)
                .onCustomTabsServiceConnected(SERVICE, client(false, sessions, null, null, null));
        await(() -> unavailable.get() == 1);

        assertEquals(1, sessions.get());
        assertEquals(0, opened.get());
        assertEquals(1, activity.unbindCalls);
        assertTrue(activity.started.isEmpty());
    }

    @Test
    public void successfulSessionLaunchesOnceInExplicitBrowserAndDisconnectDoesNotFallback() throws Exception {
        registerBrowser(BROWSER, true);
        AtomicInteger sessions = new AtomicInteger();
        handoff.openTrusted(HOME, opened::incrementAndGet, unavailable::incrementAndGet);
        CustomTabsServiceConnection connection = (CustomTabsServiceConnection) activity.lastConnection;
        CustomTabsClient client = client(true, sessions, null, null, null);

        connection.onCustomTabsServiceConnected(SERVICE, client);
        connection.onCustomTabsServiceConnected(SERVICE, client);
        await(() -> opened.get() == 1);
        connection.onServiceDisconnected(SERVICE);

        assertEquals(1, sessions.get());
        assertEquals(1, activity.started.size());
        assertEquals(BROWSER, activity.started.get(0).getPackage());
        assertEquals(HOME, activity.started.get(0).getData());
        assertEquals(0, unavailable.get());
    }

    @Test
    public void sessionIpcRunsOffMainThreadAndCancelledLateResultCannotLaunch() throws Exception {
        registerBrowser(BROWSER, true);
        AtomicInteger sessions = new AtomicInteger();
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        AtomicReference<Thread> ipcThread = new AtomicReference<>();
        handoff.openTrusted(HOME, opened::incrementAndGet, unavailable::incrementAndGet);
        CustomTabsServiceConnection connection = (CustomTabsServiceConnection) activity.lastConnection;
        try {
            connection.onCustomTabsServiceConnected(SERVICE, client(true, sessions, entered, release, ipcThread));
            assertTrue("Session worker did not start", entered.await(2, TimeUnit.SECONDS));
            assertNotSame(Thread.currentThread(), ipcThread.get());

            handoff.cancel();
            release.countDown();
            // Queue a second real session: its completion also drains posted
            // callbacks from the cancelled first attempt.
            handoff.openTrusted(HOME, opened::incrementAndGet, unavailable::incrementAndGet);
            ((CustomTabsServiceConnection) activity.lastConnection)
                    .onCustomTabsServiceConnected(SERVICE, client(false, new AtomicInteger(), null, null, null));
            await(() -> unavailable.get() == 1);

            assertEquals(0, opened.get());
            assertTrue(activity.started.isEmpty());
        } finally {
            release.countDown();
        }
    }

    @Test
    public void nonHttpsAndFinishingActivityNeverLaunchAnything() {
        registerBrowser(BROWSER, true);

        assertFalse(handoff.openBrowser(Uri.parse("file:///sdcard/page.html")));
        handoff.openTrusted(Uri.parse("javascript:alert(1)"), opened::incrementAndGet, unavailable::incrementAndGet);
        activity.finish();
        assertFalse(handoff.openBrowser(HOME));

        assertEquals(1, unavailable.get());
        assertEquals(0, activity.bindCalls);
        assertTrue(activity.started.isEmpty());
    }

    private void registerBrowser(String packageName, boolean customTabs) {
        ApplicationInfo app = new ApplicationInfo();
        app.packageName = packageName;
        app.enabled = true;
        ActivityInfo web = new ActivityInfo();
        web.packageName = packageName;
        web.name = packageName + ".WebActivity";
        web.applicationInfo = app;
        web.enabled = true;
        web.exported = true;
        PackageInfo pkg = new PackageInfo();
        pkg.packageName = packageName;
        pkg.applicationInfo = app;
        pkg.activities = new ActivityInfo[] {web};
        ServiceInfo service = new ServiceInfo();
        service.packageName = packageName;
        service.name = packageName + ".TabsService";
        service.applicationInfo = app;
        service.enabled = true;
        service.exported = true;
        if (customTabs) pkg.services = new ServiceInfo[] {service};
        shadowOf(activity.getPackageManager()).installPackage(pkg);
        ResolveInfo activityResult = new ResolveInfo();
        activityResult.activityInfo = web;
        activityResult.isDefault = true;
        shadowOf(activity.getPackageManager()).addResolveInfoForIntent(
                new Intent(Intent.ACTION_VIEW, PROBE).addCategory(Intent.CATEGORY_BROWSABLE), activityResult);
        if (customTabs) {
            ResolveInfo serviceResult = new ResolveInfo();
            serviceResult.serviceInfo = service;
            shadowOf(activity.getPackageManager()).addResolveInfoForIntent(
                    new Intent(CustomTabsService.ACTION_CUSTOM_TABS_CONNECTION).setPackage(packageName), serviceResult);
        }
    }

    private CustomTabsClient client(boolean acceptsSession, AtomicInteger sessions,
            CountDownLatch entered, CountDownLatch release, AtomicReference<Thread> ipcThread) {
        Binder binder = new Binder();
        ICustomTabsService service = (ICustomTabsService) Proxy.newProxyInstance(
                ICustomTabsService.class.getClassLoader(), new Class<?>[] {ICustomTabsService.class},
                (proxy, method, args) -> {
                    if (method.getName().equals("asBinder")) return binder;
                    if (method.getName().equals("newSession") || method.getName().equals("newSessionWithExtras")) {
                        sessions.incrementAndGet();
                        if (ipcThread != null) ipcThread.set(Thread.currentThread());
                        if (entered != null) entered.countDown();
                        if (release != null) {
                            try { release.await(2, TimeUnit.SECONDS); }
                            catch (InterruptedException cancelled) { Thread.currentThread().interrupt(); }
                        }
                        return acceptsSession;
                    }
                    if (method.getReturnType() == boolean.class) return false;
                    if (method.getReturnType() == int.class) return 1;
                    return null;
                });
        return ReflectionHelpers.callConstructor(CustomTabsClient.class,
                ClassParameter.from(ICustomTabsService.class, service),
                ClassParameter.from(ComponentName.class, SERVICE),
                ClassParameter.from(Context.class, activity.getApplicationContext()));
    }

    private static void await(BooleanSupplier condition) throws Exception {
        long end = System.nanoTime() + TimeUnit.SECONDS.toNanos(3);
        while (!condition.getAsBoolean() && System.nanoTime() < end) {
            shadowOf(Looper.getMainLooper()).idle();
            Thread.sleep(5);
        }
        shadowOf(Looper.getMainLooper()).idle();
        assertTrue("Browser callback did not arrive", condition.getAsBoolean());
    }

    private static void nullBinding(ServiceConnection connection) {
        // The framework default was added in API28. Our concrete callback also
        // exists on API26, so invoke it without linking an absent SDK method.
        ReflectionHelpers.callInstanceMethod(connection, "onNullBinding",
                ClassParameter.from(ComponentName.class, SERVICE));
    }

    public static class BrowserTestActivity extends Activity {
        final List<Intent> started = new ArrayList<>();
        boolean bindResult = true;
        boolean failDuringBind;
        int bindCalls;
        int unbindCalls;
        int rejectStarts;
        ServiceConnection lastConnection;

        @Override
        public boolean bindService(Intent service, ServiceConnection connection, int flags) {
            bindCalls++;
            lastConnection = connection;
            if (failDuringBind) nullBinding(connection);
            return bindResult;
        }

        @Override
        public void unbindService(ServiceConnection connection) {
            unbindCalls++;
        }

        @Override
        public void startActivity(Intent intent) {
            startActivity(intent, null);
        }

        @Override
        public void startActivity(Intent intent, Bundle options) {
            started.add(new Intent(intent));
            if (rejectStarts-- > 0) throw new android.content.ActivityNotFoundException("Test missing browser");
        }
    }
}
