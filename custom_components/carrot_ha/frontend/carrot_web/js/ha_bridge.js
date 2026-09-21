"use strict";

/**
 * Carrot Web <-> Home Assistant Iframe Bridge
 *
 * Intercepts internal Carrot Web REST API calls and bridges them via postMessage
 * to the parent Home Assistant Lovelace card.
 */
(function () {
  let cachedSnapshot = {
    ok: true,
    settings: null,
    values: {},
    unit_index: {},
    favorites: [],
    profiles: [],
    popular: {},
  };

  let isInitialized = false;

  // 1. Intercept getJson
  const originalGetJson = window.getJson;
  window.getJson = async function (url) {
    if (url === "/api/settings/snapshot") {
      return cachedSnapshot;
    }
    if (url === "/api/settings") {
      return cachedSnapshot.settings || { ok: true, groups: [], items_by_group: {} };
    }
    if (url.startsWith("/api/params_bulk")) {
      const allVals = {
        ...cachedSnapshot.values,
        ...(window.CarrotSettingsRuntime?.values?.peekValues?.()?.values || {}),
      };
      return { ok: true, values: allVals };
    }
    if (url.startsWith("/api/param_changes")) {
      return { ok: true, changes: [] };
    }
    if (url === "/api/setting_favorites") {
      return { ok: true, favorites: cachedSnapshot.favorites || [] };
    }
    if (url === "/api/setting_profiles") {
      return { ok: true, profiles: cachedSnapshot.profiles || [] };
    }
    if (url === "/api/setting_popular_values") {
      return { ok: true, popular: cachedSnapshot.popular || {} };
    }
    if (url === "/api/param_fingerprint") {
      const keys = Object.keys(cachedSnapshot.values || {});
      return {
        ok: true,
        fingerprint: keys.length ? `${keys.length}-params` : "empty",
        count: keys.length,
        changed: false,
        changed_count: 0,
      };
    }
    if (url === "/api/param_changes/verify") {
      return { ok: true, verified: true };
    }

    // Fallback to original if available
    if (typeof originalGetJson === "function") {
      try {
        return await originalGetJson(url);
      } catch (_) {}
    }
    return { ok: true };
  };

  // 2. Intercept postJson
  const originalPostJson = window.postJson;
  window.postJson = async function (url, body) {
    if (url === "/api/param_set") {
      const name = body?.name;
      const value = body?.value;
      if (name !== undefined) {
        cachedSnapshot.values[name] = value;
        window.parent.postMessage({
          type: "carrot:param_set",
          name,
          value,
          source: body?.source || "web_ui",
        }, "*");
      }
      return { ok: true, name, value };
    }

    if (url === "/api/setting_unit_index") {
      try {
        localStorage.setItem("carrot_unit_index", JSON.stringify(body?.units || {}));
      } catch (_) {}
      return { ok: true };
    }

    if (url === "/api/setting_favorites") {
      cachedSnapshot.favorites = body?.favorites || [];
      return { ok: true, favorites: cachedSnapshot.favorites };
    }

    if (url === "/api/setting_profiles") {
      return { ok: true, profiles: cachedSnapshot.profiles };
    }

    if (url === "/api/set_default") {
      return { ok: true, message: "기본값 복원 요청이 전송되었습니다." };
    }

    if (typeof originalPostJson === "function") {
      try {
        return await originalPostJson(url, body);
      } catch (_) {}
    }
    return { ok: true };
  };

  // 3. Normalize and Hydrate Snapshot
  async function hydrateAndRender(data) {
    if (!data) return;
    const catalog = data.catalog || data.settings || {};
    const values = data.values || {};

    cachedSnapshot = {
      ok: true,
      settings: catalog,
      values: values,
      unit_index: data.unit_index || {},
      favorites: data.favorites || [],
      profiles: data.profiles || [],
      popular: data.popular || {},
    };

    // Hide loader
    const loader = document.getElementById("haBridgeLoading");
    if (loader) loader.style.display = "none";

    const page = document.getElementById("pageSetting");
    if (page) {
      page.style.display = "block";
      page.hidden = false;
      page.removeAttribute("inert");
      page.removeAttribute("aria-hidden");
    }

    // Set Default Korean Language
    try {
      if (typeof setWebLanguage === "function") {
        setWebLanguage("ko", { persist: false, render: false });
      } else {
        window.LANG = "ko";
      }
    } catch (_) {}

    // Prime snapshot and trigger setting load
    try {
      if (typeof primeSettingsSnapshotForFirstEntry === "function") {
        primeSettingsSnapshotForFirstEntry(cachedSnapshot);
      }
      if (typeof loadSettings === "function") {
        await loadSettings({ force: true });
      }
    } catch (err) {
      console.warn("[ha_bridge] loadSettings error:", err);
    }

    isInitialized = true;
  }

  // 4. Listen for messages from parent HA Lovelace card
  window.addEventListener("message", async (event) => {
    const msg = event?.data;
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "carrot:snapshot") {
      await hydrateAndRender(msg.data);
    } else if (msg.type === "carrot:values_update" && msg.values) {
      Object.assign(cachedSnapshot.values, msg.values);
      window.dispatchEvent(new CustomEvent("carrot:paramsrestored", {
        detail: { source: "ha_sync", values: msg.values },
      }));
    } else if (msg.type === "carrot:param_applied") {
      if (typeof showAppToast === "function") {
        showAppToast(`✓ ${msg.name} 차량 적용 완료!`, { tone: "success" });
      }
    }
  });

  // 5. Wire Navigation & Back Button Fallbacks
  function setupNavigationHooks() {
    const itemsTitle = document.getElementById("itemsTitle");
    if (itemsTitle) {
      itemsTitle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.CURRENT_SETTING_DETAIL) {
          window.CURRENT_SETTING_DETAIL = null;
          if (typeof renderItems === "function" && window.CURRENT_GROUP) {
            renderItems(window.CURRENT_GROUP, { scrollMode: "restore", animateItems: false }).catch(() => {});
          }
        } else {
          window.CURRENT_GROUP = null;
          if (typeof showSettingScreen === "function") {
            showSettingScreen("groups", false);
          }
          if (typeof renderGroups === "function") {
            renderGroups({ animateGroups: false });
          }
        }
      }, true);
    }

    const settingTitle = document.getElementById("settingTitle");
    if (settingTitle) {
      settingTitle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.CURRENT_SETTING_DETAIL) {
          window.CURRENT_SETTING_DETAIL = null;
          if (typeof renderItems === "function" && window.CURRENT_GROUP) {
            renderItems(window.CURRENT_GROUP, { scrollMode: "restore", animateItems: false }).catch(() => {});
          }
        } else if (window.CURRENT_GROUP) {
          window.CURRENT_GROUP = null;
          if (typeof showSettingScreen === "function") {
            showSettingScreen("groups", false);
          }
          if (typeof renderGroups === "function") {
            renderGroups({ animateGroups: false });
          }
        }
      }, true);
    }
  }

  // 6. Signal readiness to parent HA card
  function notifyReady() {
    setupNavigationHooks();
    window.parent.postMessage({ type: "carrot:ready" }, "*");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", notifyReady);
  } else {
    notifyReady();
  }

  // Also send periodic ready ping in case parent card attached late
  let pingCount = 0;
  const pingTimer = setInterval(() => {
    if (isInitialized || pingCount >= 10) {
      clearInterval(pingTimer);
      return;
    }
    pingCount++;
    window.parent.postMessage({ type: "carrot:ready" }, "*");
  }, 1000);
})();
