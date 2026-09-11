// Dunne laag rondom de GitHub Contents API.
// Gebruikt als opslag i.p.v. een database: elke schrijfactie is een commit in de repo.
//
// Risico (bewust geaccepteerd, zie projectbrief): het token staat alleen in localStorage
// van de browser die het invoert (nooit in een gecommit bestand), maar geeft nog steeds
// volledige schrijftoegang tot de repo. Voor een grotere/gevoeligere versie: eigen backend.

const GitHubAPI = (() => {
  const TOKEN_KEY = "gh_token";

  function getToken() {
    // Lokaal ingesteld token (admin-dashboard) heeft voorrang; anders het
    // token uit config.js, dat met de site wordt meegepubliceerd zodat
    // klanten zelf bestellingen kunnen wegschrijven zonder eigen token.
    return localStorage.getItem(TOKEN_KEY) || (typeof CONFIG !== "undefined" && CONFIG.githubToken) || "";
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  function apiUrl(path) {
    return `https://api.github.com/repos/${CONFIG.githubOwner}/${CONFIG.githubRepo}/contents/${path}`;
  }

  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary);
  }

  function base64ToUtf8(base64) {
    const binary = atob(base64.replace(/\n/g, ""));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  // Leest een bestand uit de repo. Werkt ook zonder token (publieke repo).
  // Geeft { content, sha } terug, of { content: null, sha: null } als het bestand niet bestaat.
  async function getFile(path) {
    const token = getToken();
    const headers = { Accept: "application/vnd.github+json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${apiUrl(path)}?ref=${CONFIG.githubBranch}`, { headers });
    if (res.status === 404) return { content: null, sha: null };
    if (!res.ok) throw new Error(`GitHub API fout bij lezen van ${path}: ${res.status}`);

    const data = await res.json();
    return { content: base64ToUtf8(data.content), sha: data.sha };
  }

  // Schrijft (maakt of update) een bestand. sha is verplicht bij een update, leeg bij nieuw bestand.
  async function putFile(path, content, message, sha) {
    const token = getToken();
    if (!token) throw new Error("Geen GitHub-token ingesteld.");

    const body = {
      message,
      content: utf8ToBase64(content),
      branch: CONFIG.githubBranch,
    };
    if (sha) body.sha = sha;

    const res = await fetch(apiUrl(path), {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`GitHub API fout bij schrijven van ${path}: ${res.status} ${err.message || ""}`);
    }
    return res.json();
  }

  // Gemakshelper: leest JSON, geeft geparsed object + sha terug.
  async function getJson(path) {
    const { content, sha } = await getFile(path);
    return { data: content ? JSON.parse(content) : null, sha };
  }

  // Gemakshelper: schrijft een object als geformatteerde JSON.
  async function putJson(path, obj, message, sha) {
    return putFile(path, JSON.stringify(obj, null, 2) + "\n", message, sha);
  }

  // Lijst bestanden in een map. Geeft [] terug als de map niet bestaat.
  async function getDirectory(path) {
    const token = getToken();
    const headers = { Accept: "application/vnd.github+json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${apiUrl(path)}?ref=${CONFIG.githubBranch}`, { headers });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`GitHub API fout bij lezen van map ${path}: ${res.status}`);
    return res.json();
  }

  return { getToken, setToken, clearToken, getFile, putFile, getJson, putJson, getDirectory };
})();
