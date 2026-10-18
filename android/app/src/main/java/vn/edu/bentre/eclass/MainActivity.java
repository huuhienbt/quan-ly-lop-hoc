package vn.edu.bentre.eclass;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

/** A visible, bounded handoff to a real browser; login never runs in a WebView. */
public class MainActivity extends Activity {
    protected static final long CONNECT_TIMEOUT_MS = 6_000;
    private static final String HOME = "https://e-class-vinhlong.vercel.app/";
    private static final String OPENED_STATE = "eclass.browser_opened";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private BrowserHandoff handoff;
    private Uri launchUrl;
    private TextView status;
    private ProgressBar progress;
    private Button retry;
    private Runnable deadline;
    private int generation;
    private boolean foreground;
    private boolean started;
    private boolean waiting;
    private boolean browserOpened;
    private boolean destroyed;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        browserOpened = savedInstanceState != null && savedInstanceState.getBoolean(OPENED_STATE);
        started = browserOpened;
        setContentView(R.layout.activity_main);
        View root = findViewById(R.id.launch_root);
        int padding = Math.round(24 * getResources().getDisplayMetrics().density);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(padding + insets.getSystemWindowInsetLeft(),
                    padding + insets.getSystemWindowInsetTop(),
                    padding + insets.getSystemWindowInsetRight(),
                    padding + insets.getSystemWindowInsetBottom());
            return insets;
        });
        status = findViewById(R.id.launch_status);
        progress = findViewById(R.id.launch_progress);
        retry = findViewById(R.id.launch_retry);
        launchUrl = safeLaunchUrl(getIntent() == null ? null : getIntent().getData());
        handoff = createBrowserHandoff();
        retry.setOnClickListener(view -> beginTrusted());
        findViewById(R.id.launch_browser).setOnClickListener(view -> openBrowser());
        findViewById(R.id.launch_copy).setOnClickListener(view -> {
            ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            if (clipboard != null) {
                // Copy only the public home address, never an OAuth callback code.
                clipboard.setPrimaryClip(ClipData.newPlainText(getString(R.string.app_name), HOME));
                Toast.makeText(this, R.string.launch_copied, Toast.LENGTH_SHORT).show();
            }
        });
    }

    protected BrowserHandoff createBrowserHandoff() { return new AndroidBrowserHandoff(this); }

    public static Uri safeLaunchUrl(Uri requested) {
        if (requested != null && requested.isHierarchical()
                && "https".equalsIgnoreCase(requested.getScheme())
                && "e-class-vinhlong.vercel.app".equalsIgnoreCase(requested.getHost())
                && requested.getUserInfo() == null
                && (requested.getPort() == -1 || requested.getPort() == 443)) return requested;
        return Uri.parse(HOME);
    }

    @Override protected void onResume() {
        super.onResume();
        foreground = true;
        if (browserOpened) {
            // Back from a stalled browser must leave usable recovery controls,
            // rather than finish or immediately open that browser again.
            browserOpened = false;
            cancelPending();
            progress.setVisibility(View.GONE);
            status.setText(R.string.launch_ready);
            retry.setEnabled(true);
            return;
        }
        if (!started) { started = true; beginTrusted(); }
    }

    private boolean usable() { return foreground && !destroyed && !isFinishing(); }

    private void beginTrusted() {
        if (!usable() || handoff == null) return;
        cancelPending();
        browserOpened = false;
        waiting = true;
        int attempt = generation;
        progress.setVisibility(View.VISIBLE);
        status.setText(R.string.launch_waiting);
        retry.setEnabled(false);
        deadline = () -> {
            if (usable() && waiting && generation == attempt) openBrowser();
        };
        // Register before binding; callbacks are allowed to arrive immediately.
        handler.postDelayed(deadline, CONNECT_TIMEOUT_MS);
        try {
            handoff.openTrusted(launchUrl, () -> {
                if (!usable() || !waiting || generation != attempt) return;
                waiting = false;
                clearDeadline();
                browserOpened = true;
                progress.setVisibility(View.GONE);
                status.setText(R.string.launch_opened);
                retry.setEnabled(true);
            }, () -> {
                if (usable() && waiting && generation == attempt) openBrowser();
            });
        } catch (RuntimeException error) {
            if (usable() && waiting && generation == attempt) openBrowser();
        }
    }

    private void openBrowser() {
        if (!usable() || handoff == null) return;
        cancelPending();
        browserOpened = false;
        boolean opened;
        try { opened = handoff.openBrowser(launchUrl); }
        catch (RuntimeException error) { opened = false; }
        browserOpened = opened;
        progress.setVisibility(View.GONE);
        retry.setEnabled(true);
        status.setText(opened ? R.string.launch_opened : R.string.launch_unavailable);
    }

    private void clearDeadline() {
        if (deadline != null) handler.removeCallbacks(deadline);
        deadline = null;
    }

    private void cancelPending() {
        // Invalidate before unbinding, including reentrant or late browser callbacks.
        generation++;
        waiting = false;
        clearDeadline();
        if (handoff != null) handoff.cancel();
    }

    @Override protected void onPause() {
        foreground = false;
        if (waiting) {
            cancelPending();
            progress.setVisibility(View.GONE);
            retry.setEnabled(true);
            status.setText(R.string.launch_ready);
        }
        super.onPause();
    }

    @Override protected void onSaveInstanceState(Bundle outState) {
        outState.putBoolean(OPENED_STATE, browserOpened);
        super.onSaveInstanceState(outState);
    }

    @Override protected void onDestroy() {
        destroyed = true;
        foreground = false;
        cancelPending();
        super.onDestroy();
    }
}
