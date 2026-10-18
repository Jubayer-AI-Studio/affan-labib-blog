// src/lib/githubSync.ts
// Automatic Cloud Sync via GitHub REST API

const GITHUB_TOKEN =
  process.env.GITHUB_TOKEN ||
  process.env.GH_TOKEN ||
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.GITHUB_TOKEN || import.meta.env.GH_TOKEN)) ||
  '';

const REPO_OWNER = 'Jubayer-AI-Studio';
const REPO_NAME = 'affan-labib-blog-v2';
const FILE_PATH = 'src/data/posts.json';

export async function syncPostsToGitHub(posts: any[]): Promise<boolean> {
  if (!GITHUB_TOKEN) {
    console.warn('[GitHub Sync] No token found, skipping GitHub commit.');
    return false;
  }

  try {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    const headers = {
      Authorization: `token ${GITHUB_TOKEN}`,
      'User-Agent': 'Astro-Affan-Labib-Blog',
      Accept: 'application/vnd.github.v3+json'
    };

    // 1. Get current file SHA with cache-buster
    const getRes = await fetch(`${url}?ref=main&_nocache=${Date.now()}`, {
      headers,
      cache: 'no-store'
    });
    if (!getRes.ok) {
      console.error('[GitHub Sync] Failed to get file SHA:', getRes.status, await getRes.text());
      return false;
    }

    const fileData = await getRes.json();
    const sha = fileData.sha;

    // 2. Encode updated JSON to base64 UTF-8
    const jsonStr = JSON.stringify(posts, null, 2);
    const base64Content = Buffer.from(jsonStr, 'utf-8').toString('base64');

    // 3. Commit update
    const putRes = await fetch(url, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `chore(cms): update posts.json via writer studio [skip ci]`,
        content: base64Content,
        sha
      })
    });

    if (putRes.ok) {
      console.log('[GitHub Sync] Successfully committed updated posts.json to GitHub!');
      return true;
    } else {
      console.error('[GitHub Sync] Commit failed:', putRes.status, await putRes.text());
      return false;
    }
  } catch (err: any) {
    console.error('[GitHub Sync] Error syncing to GitHub:', err.message);
    return false;
  }
}
