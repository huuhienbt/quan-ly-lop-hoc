package vn.edu.bentre.eclass;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.robolectric.Shadows.shadowOf;

import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Looper;
import android.os.SystemClock;
import android.view.View;
import android.widget.TextView;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.LooperMode;

/** Exercises launcher lifecycle and delayed browser callbacks without a real browser service. */
@RunWith(org.robolectric.RobolectricTestRunner.class)
@Config(sdk = {26, 36})
@LooperMode(LooperMode.Mode.PAUSED)
public class MainActivityTest {
    private static final Uri HOME = Uri.parse("https://e-class-vinhlong.vercel.app/");

    private ActivityController<TestActivity> controller;

    @After
    public void cleanUp() {
        if (controller != null && !controller.get().isDestroyed()) {
            controller.pause().stop().destroy();
        }
        shadowOf(Looper.getMainLooper()).idle();
    }

    @Test
    public void coldStartShowsNativeStatusAndStartsOneBrowserAttempt() {
        TestActivity activity = launch();

        assertNotNull(activity.findViewById(R.id.launch_status));
        assertFalse(((TextView) activity.findViewById(R.id.launch_status))
                .getText().toString().trim().isEmpty());
        assertEquals(View.VISIBLE, activity.findViewById(R.id.launch_progress).getVisibility());
        assertNotNull(activity.findViewById(R.id.launch_retry));
        assertNotNull(activity.findViewById(R.id.launch_browser));
        assertNotNull(activity.findViewById(R.id.launch_copy));
        assertEquals(1, activity.handoff.attempts.size());
        assertEquals(HOME, activity.handoff.attempts.get(0).url);
        assertFalse(activity.isFinishing());
    }

    @Test
    public void stalledServiceFallsBackExactlyOnceAtDeadline() {
        TestActivity activity = launch();

        // Attaching the window may advance Robolectric's clock by a frame.
        // Measure against the actual request, rather than the later visible().
        long remaining = MainActivity.CONNECT_TIMEOUT_MS
                - (SystemClock.uptimeMillis() - activity.handoff.attempts.get(0).requestedAt);
        assertTrue(remaining > 0);
        advance(remaining - 1);
        assertEquals(0, activity.handoff.browserCalls);
        advance(1);

        assertEquals(1, activity.handoff.browserCalls);
        assertEquals(HOME, activity.handoff.browserUrl);
        assertTrue(activity.handoff.cancelCalls > 0);
        advance(MainActivity.CONNECT_TIMEOUT_MS * 3);
        assertEquals(1, activity.handoff.browserCalls);
    }

    @Test
    public void lateServiceCallbacksCannotStartAnotherFallback() {
        TestActivity activity = launch();
        Attempt old = activity.handoff.attempts.get(0);
        advance(MainActivity.CONNECT_TIMEOUT_MS);

        old.unavailable.run();
        old.opened.run();
        shadowOf(Looper.getMainLooper()).idle();

        assertEquals(1, activity.handoff.browserCalls);
        assertFalse(activity.isFinishing());
    }

    @Test
    public void unavailableServiceFallsBackWithoutWaitingForDeadline() {
        TestActivity activity = launch();

        activity.handoff.attempts.get(0).unavailable.run();
        shadowOf(Looper.getMainLooper()).idle();

        assertEquals(1, activity.handoff.browserCalls);
        advance(MainActivity.CONNECT_TIMEOUT_MS * 2);
        assertEquals(1, activity.handoff.browserCalls);
    }

    @Test
    public void noBrowserLeavesUsableRecoveryScreenAndRetryStartsNewAttempt() {
        TestActivity activity = launch();
        activity.handoff.browserAvailable = false;
        Attempt old = activity.handoff.attempts.get(0);

        old.unavailable.run();
        shadowOf(Looper.getMainLooper()).idle();

        assertEquals(View.GONE, activity.findViewById(R.id.launch_progress).getVisibility());
        assertTrue(activity.findViewById(R.id.launch_retry).isEnabled());
        assertTrue(activity.findViewById(R.id.launch_browser).isEnabled());
        assertTrue(activity.findViewById(R.id.launch_copy).isEnabled());
        assertFalse(activity.isFinishing());
        activity.findViewById(R.id.launch_retry).performClick();
        assertEquals(2, activity.handoff.attempts.size());
        assertEquals(View.VISIBLE, activity.findViewById(R.id.launch_progress).getVisibility());

        old.unavailable.run();
        old.opened.run();
        shadowOf(Looper.getMainLooper()).idle();
        assertEquals(1, activity.handoff.browserCalls);
        advance(MainActivity.CONNECT_TIMEOUT_MS);
        assertEquals(2, activity.handoff.browserCalls);
    }

    @Test
    public void successfulBrowserHandoffCancelsDeadlineAndOffersRecoveryWhenReturning() {
        TestActivity activity = launch();

        activity.handoff.attempts.get(0).opened.run();
        shadowOf(Looper.getMainLooper()).idle();
        advance(MainActivity.CONNECT_TIMEOUT_MS * 2);

        assertEquals(0, activity.handoff.browserCalls);
        assertFalse(activity.isFinishing());
        controller.pause().resume();
        assertFalse(activity.isFinishing());
        assertEquals(View.GONE, activity.findViewById(R.id.launch_progress).getVisibility());
        assertTrue(activity.findViewById(R.id.launch_retry).isEnabled());
        assertTrue(activity.findViewById(R.id.launch_browser).isEnabled());
        assertEquals(1, activity.handoff.attempts.size());
    }

    @Test
    public void pausingPendingAttemptCancelsItAndDoesNotAutoLaunchOnReturn() {
        TestActivity activity = launch();
        Attempt old = activity.handoff.attempts.get(0);
        int cancellations = activity.handoff.cancelCalls;

        controller.pause();
        assertTrue(activity.handoff.cancelCalls > cancellations);
        advance(MainActivity.CONNECT_TIMEOUT_MS * 2);
        old.unavailable.run();
        old.opened.run();
        controller.resume();
        shadowOf(Looper.getMainLooper()).idle();

        assertEquals(1, activity.handoff.attempts.size());
        assertEquals(0, activity.handoff.browserCalls);
        assertEquals(View.GONE, activity.findViewById(R.id.launch_progress).getVisibility());
        assertTrue(activity.findViewById(R.id.launch_retry).isEnabled());
        assertFalse(activity.isFinishing());
    }

    @Test
    public void destroyedActivityIgnoresCallbacksAndDoesNotOpenBrowser() {
        TestActivity activity = launch();
        Attempt old = activity.handoff.attempts.get(0);
        int cancellations = activity.handoff.cancelCalls;

        controller.pause().stop().destroy();
        assertTrue(activity.handoff.cancelCalls > cancellations);
        old.unavailable.run();
        old.opened.run();
        advance(MainActivity.CONNECT_TIMEOUT_MS * 2);

        assertEquals(0, activity.handoff.browserCalls);
        assertEquals(1, activity.handoff.attempts.size());
    }

    @Test
    public void explicitBrowserButtonCancelsPendingTrustedLaunchAndItsDeadline() {
        TestActivity activity = launch();
        Attempt old = activity.handoff.attempts.get(0);

        activity.findViewById(R.id.launch_browser).performClick();
        assertEquals(1, activity.handoff.browserCalls);
        old.unavailable.run();
        old.opened.run();
        advance(MainActivity.CONNECT_TIMEOUT_MS * 2);

        assertEquals(1, activity.handoff.browserCalls);
        assertEquals(1, activity.handoff.attempts.size());
        assertFalse(activity.isFinishing());
    }

    @Test
    public void copyButtonCopiesPublicHomeWithoutDeepLinkOrOAuthQuerySecrets() {
        Uri requested = Uri.parse("https://e-class-vinhlong.vercel.app/api/auth/callback/google?code=private-code");
        TestActivity activity = launch(new Intent(Intent.ACTION_VIEW, requested));

        activity.findViewById(R.id.launch_copy).performClick();

        ClipboardManager clipboard = (ClipboardManager) activity.getSystemService(Context.CLIPBOARD_SERVICE);
        assertNotNull(clipboard.getPrimaryClip());
        assertEquals(HOME.toString(), clipboard.getPrimaryClip().getItemAt(0).getText().toString());
    }

    @Test
    public void synchronousUnavailableCallbackFallsBackOnceAndClearsDeadline() {
        controller = Robolectric.buildActivity(TestActivity.class).create().start();
        TestActivity activity = controller.get();
        activity.handoff.failImmediately = true;

        controller.resume().visible();
        advance(MainActivity.CONNECT_TIMEOUT_MS * 2);

        assertEquals(1, activity.handoff.attempts.size());
        assertEquals(1, activity.handoff.browserCalls);
        assertEquals(View.GONE, activity.findViewById(R.id.launch_progress).getVisibility());
    }

    @Test
    public void synchronousOpenedCallbackClearsAlreadyRegisteredDeadline() {
        controller = Robolectric.buildActivity(TestActivity.class).create().start();
        TestActivity activity = controller.get();
        activity.handoff.openImmediately = true;

        controller.resume().visible();
        advance(MainActivity.CONNECT_TIMEOUT_MS * 2);

        assertEquals(1, activity.handoff.attempts.size());
        assertEquals(0, activity.handoff.browserCalls);
        assertFalse(activity.isFinishing());
        controller.pause().resume();
        assertFalse(activity.isFinishing());
        assertTrue(activity.findViewById(R.id.launch_retry).isEnabled());
    }

    @Test
    public void browserExceptionLeavesRecoveryControlsEnabled() {
        TestActivity activity = launch();
        activity.handoff.throwBrowser = true;

        activity.handoff.attempts.get(0).unavailable.run();
        advance(MainActivity.CONNECT_TIMEOUT_MS * 2);

        assertEquals(1, activity.handoff.browserCalls);
        assertEquals(View.GONE, activity.findViewById(R.id.launch_progress).getVisibility());
        assertTrue(activity.findViewById(R.id.launch_retry).isEnabled());
        assertTrue(activity.findViewById(R.id.launch_browser).isEnabled());
        assertTrue(activity.findViewById(R.id.launch_copy).isEnabled());
        assertFalse(activity.isFinishing());
    }

    @Test
    public void trustedLaunchExceptionFallsBackAndReentrantCancellationCannotDuplicateIt() {
        controller = Robolectric.buildActivity(TestActivity.class).create().start();
        TestActivity activity = controller.get();
        activity.handoff.throwTrusted = true;
        activity.handoff.failOnCancel = true;

        controller.resume().visible();
        advance(MainActivity.CONNECT_TIMEOUT_MS * 2);

        assertEquals(1, activity.handoff.attempts.size());
        assertEquals(1, activity.handoff.browserCalls);
        assertEquals(View.GONE, activity.findViewById(R.id.launch_progress).getVisibility());
    }

    @Test
    public void recreatingPendingLaunchStartsOnlyOneFreshAttemptAndInvalidatesOldCallbacks() {
        TestActivity original = launch();
        Attempt old = original.handoff.attempts.get(0);
        Bundle saved = new Bundle();
        controller.saveInstanceState(saved).pause().stop().destroy();

        controller = Robolectric.buildActivity(TestActivity.class).create(saved).start().resume().visible();
        TestActivity recreated = controller.get();
        old.opened.run();
        old.unavailable.run();
        shadowOf(Looper.getMainLooper()).idle();

        assertEquals(1, recreated.handoff.attempts.size());
        assertEquals(0, original.handoff.browserCalls);
        assertEquals(0, recreated.handoff.browserCalls);
        assertFalse(recreated.isFinishing());
        advance(MainActivity.CONNECT_TIMEOUT_MS);
        assertEquals(1, recreated.handoff.browserCalls);
    }

    @Test
    public void recreatingAfterBrowserOpenedShowsRecoveryWithoutOpeningAnotherBrowser() {
        TestActivity original = launch();
        original.handoff.attempts.get(0).opened.run();
        shadowOf(Looper.getMainLooper()).idle();
        Bundle saved = new Bundle();
        controller.saveInstanceState(saved).pause().stop().destroy();

        controller = Robolectric.buildActivity(TestActivity.class).create(saved).start().resume().visible();
        TestActivity recreated = controller.get();
        advance(MainActivity.CONNECT_TIMEOUT_MS * 2);

        assertFalse(recreated.isFinishing());
        assertEquals(View.GONE, recreated.findViewById(R.id.launch_progress).getVisibility());
        assertTrue(recreated.findViewById(R.id.launch_retry).isEnabled());
        assertTrue(recreated.findViewById(R.id.launch_browser).isEnabled());
        assertEquals(0, recreated.handoff.attempts.size());
        assertEquals(0, recreated.handoff.browserCalls);
    }

    @Test
    public void onlySameOriginHttpsLinksAreAccepted() {
        Uri allowed = Uri.parse("https://e-class-vinhlong.vercel.app/hoc-sinh?tab=lich#tro-chuyen");
        assertEquals(allowed, MainActivity.safeLaunchUrl(allowed));
        assertEquals(HOME, MainActivity.safeLaunchUrl(null));
        assertEquals(HOME, MainActivity.safeLaunchUrl(Uri.parse("https://example.com/hoc-sinh")));
        assertEquals(HOME, MainActivity.safeLaunchUrl(Uri.parse("http://e-class-vinhlong.vercel.app/")));
        assertEquals(HOME, MainActivity.safeLaunchUrl(Uri.parse("file:///sdcard/index.html")));
        assertEquals(HOME, MainActivity.safeLaunchUrl(Uri.parse("javascript:alert(1)")));
        assertEquals(HOME, MainActivity.safeLaunchUrl(Uri.parse("https://user:password@e-class-vinhlong.vercel.app/")));
        assertEquals(HOME, MainActivity.safeLaunchUrl(Uri.parse("https://e-class-vinhlong.vercel.app:8443/")));
        assertEquals(HOME, MainActivity.safeLaunchUrl(Uri.parse("https://e-class-vinhlong.vercel.app.example.com/")));
    }

    private TestActivity launch() {
        return launch(new Intent(Intent.ACTION_MAIN));
    }

    private TestActivity launch(Intent intent) {
        controller = Robolectric.buildActivity(TestActivity.class, intent).create().start().resume().visible();
        return controller.get();
    }

    private static void advance(long millis) {
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(millis));
    }

    public static class TestActivity extends MainActivity {
        final FakeHandoff handoff = new FakeHandoff();

        @Override
        protected BrowserHandoff createBrowserHandoff() {
            return handoff;
        }
    }

    static final class Attempt {
        final Uri url;
        final Runnable opened;
        final Runnable unavailable;
        final long requestedAt = SystemClock.uptimeMillis();

        Attempt(Uri url, Runnable opened, Runnable unavailable) {
            this.url = url;
            this.opened = opened;
            this.unavailable = unavailable;
        }
    }

    static final class FakeHandoff implements BrowserHandoff {
        final List<Attempt> attempts = new ArrayList<>();
        boolean browserAvailable = true;
        boolean openImmediately;
        boolean failImmediately;
        boolean throwTrusted;
        boolean throwBrowser;
        boolean failOnCancel;
        int browserCalls;
        int cancelCalls;
        Uri browserUrl;

        @Override
        public void openTrusted(Uri url, Runnable onOpened, Runnable onUnavailable) {
            attempts.add(new Attempt(url, onOpened, onUnavailable));
            if (throwTrusted) throw new IllegalStateException("Test browser bind failure");
            if (openImmediately) onOpened.run();
            else if (failImmediately) onUnavailable.run();
        }

        @Override
        public boolean openBrowser(Uri url) {
            browserCalls++;
            browserUrl = url;
            if (throwBrowser) throw new IllegalStateException("Test browser activity failure");
            return browserAvailable;
        }

        @Override
        public void cancel() {
            cancelCalls++;
            if (failOnCancel && !attempts.isEmpty()) {
                attempts.get(attempts.size() - 1).unavailable.run();
            }
        }
    }
}
