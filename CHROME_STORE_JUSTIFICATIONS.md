# Chrome Web Store Submission Justifications

## Host Permission Justification

**Not required:** This extension does not use `host_permissions`. The extension accesses YouTube Studio through content scripts declared in the manifest with `matches: ["https://studio.youtube.com/*"]`, which automatically grants access to those URLs. No separate host permissions are needed since the extension only uses `chrome.storage` (which doesn't require host permissions) and content scripts (which gain access via their `matches` field).

---

## Remote Code Justification

**Required permission:** Remote code execution

**Justification:**
This extension injects `inject.js` into the YouTube Studio page context to intercept and extract analytics data from YouTube's internal API responses. This is necessary because:
- YouTube Studio loads analytics data via internal network requests that are not accessible through standard DOM APIs
- The extension needs to capture real-time data (views, likes, comments, subscribers, revenue, watch time) as it is fetched by YouTube Studio
- The injected script intercepts `fetch` requests and `MessageChannel` communications to extract this data before YouTube's UI consumes it
- This data extraction enables the custom analytics dashboard to display metrics that YouTube Studio collects but does not display in the default interface

The remote code (`inject.js`) is bundled with the extension and does not fetch or execute code from external servers. All code execution happens locally within the extension package.

---

## Storage Justification

**Required permission:** `storage`

**Justification:**
This extension uses `chrome.storage.local` to persist user preferences and settings across browser sessions. Specifically, the extension stores:
- **Badge visibility settings**: User preferences for showing/hiding likes, comments, and dislikes badges
- **Panel visibility settings**: User preferences for showing/hiding top banner panels (subscribers, watchtime, likes, comments, revenue)
- **Hidden elements preferences**: User preferences for hiding specific YouTube Studio dashboard cards and tabs
- **Electron backend configuration**: Optional settings for connecting to the optional local Electron backend server (enabled/disabled status and URL)
- **Hot streak configuration**: User-configurable thresholds for hot streak detection (number of increases and time window)

This storage is necessary to provide a consistent user experience where preferences are remembered between page reloads and browser restarts. All data is stored locally on the user's device and is never transmitted to external servers.

---

## Single Purpose Description

**Extension Purpose:**
This extension has a single, focused purpose: to enhance YouTube Studio with additional analytics features and improved user interface elements. Specifically, it:

1. **Displays enhanced analytics**: Shows additional metrics (48-hour views, 60-minute views, estimated revenue, watch time, CTR) in a custom live analytics dashboard that YouTube Studio does not display by default

2. **Provides quick access menu**: Adds a convenient top menu for quick navigation between scheduled/public posts and shorts

3. **Improves user experience**: Applies modern styling improvements and allows users to customize which elements are visible (badges, panels, dashboard cards)

4. **Optional backend integration**: Provides an optional connection to a local Electron backend server for mobile/remote access to analytics (completely optional feature)

All features work exclusively within YouTube Studio and are designed to complement, not replace, the existing YouTube Studio functionality. The extension does not collect user data, track users, or communicate with external servers beyond the optional local backend connection.

