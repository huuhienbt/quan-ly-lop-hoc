package vn.edu.bentre.eclass;

import android.net.Uri;

/** Browser launch boundary used by the visible launcher and its lifecycle tests. */
interface BrowserHandoff {
    void openTrusted(Uri target, Runnable onOpened, Runnable onUnavailable);

    boolean openBrowser(Uri target);

    void cancel();
}
