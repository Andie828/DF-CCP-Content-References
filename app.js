const selectedSeed = (() => {
  try { return JSON.parse(localStorage.getItem("briefSelection") || "[]"); }
  catch (e) { return []; }
})();
const state = {
  data: null,
  lang: localStorage.getItem("lang") || "zh",
  overallIndex: 0,
  filter: "all",
  sourceType: null,
  captions: [],
  captionUrl: "",
  youtubeReady: false,
  selectedIds: new Set(selectedSeed),
};
let ytPlayer = null;
let pendingYoutubeId = null;
const fmt = new Intl.NumberFormat("zh-Hant");
const $ = (id) => document.getElementById(id);
const EXTRA = {
  zh: {
    all:"全部", guide:"教學取向", value:"價值取向", fun:"搞笑取向", overall:"總排名", heat:"互動熱度",
    view:"播放", like:"點讚", comment:"留言", share:"分享", collect:"收藏", favorite:"收藏夾",
    source:"原始連結", caption:"字幕檔", transcript:"ASR 校對稿", tags:"主類別與標籤", status:"播放與字幕狀態",
    analysis:"摘要分析", pending:"待補來源", playable:"可播放", bilibili:"Bilibili 備援", youtube:"YouTube 已就緒",
    selected:"已選", clear:"清空勾選", export:"匯出 Brief (.txt)", copy:"複製本支 Brief", add:"加入匯出", remove:"移出匯出",
    brief:"輸出預覽", localTitle:"Translated title", primaryCategory:"Primary category", sourceField:"Source link",
    copied:"已複製", noSelection:"請先勾選至少 1 支影片", exportReady:"可直接轉發給當地團隊或創作者的精簡文字包"
  },
  en: {
    all:"All", guide:"Guide & Tutorials", value:"Rewards & Value", fun:"Fun & Memes", overall:"Overall ranking", heat:"Engagement",
    view:"Views", like:"Likes", comment:"Comments", share:"Shares", collect:"Collects", favorite:"Favorites",
    source:"Source", caption:"Subtitle file", transcript:"ASR transcript", tags:"Primary category & tags", status:"Playback & subtitle status",
    analysis:"Editorial analysis", pending:"Pending source", playable:"Playable", bilibili:"Bilibili fallback", youtube:"YouTube ready",
    selected:"Selected", clear:"Clear picks", export:"Export Brief (.txt)", copy:"Copy this brief", add:"Add to export", remove:"Remove from export",
    brief:"Export preview", localTitle:"Translated title", primaryCategory:"Primary category", sourceField:"Source link",
    copied:"Copied", noSelection:"Select at least one video first", exportReady:"A lean text pack ready to forward to local teams or creators"
  },
};
function ex(key){ return (EXTRA[state.lang] && EXTRA[state.lang][key]) || EXTRA.en[key] || key; }
function t(key){ return (state.data.ui[state.lang] && state.data.ui[state.lang][key]) || (state.data.ui.zh && state.data.ui.zh[key]) || key; }
function currentVideos(){ return state.filter === "all" ? state.data.videos : state.data.videos.filter(v => v.primary_campaign_category === state.filter); }
function currentVideo(){ return state.data.videos[state.overallIndex]; }
function localizedTitle(video){
  return (video.copy && video.copy[state.lang] && video.copy[state.lang].title)
    || (video.copy && video.copy.zh && video.copy.zh.title)
    || video.title
    || "";
}
function localizedBullets(video){ return (video.insight_bullets && (video.insight_bullets[state.lang] || video.insight_bullets.zh)) || []; }
function localizedTags(video){ return (video.tag_translations && (video.tag_translations[state.lang] || video.tag_translations.zh)) || video.video_type_tags || []; }
function saveSelection(){ localStorage.setItem("briefSelection", JSON.stringify([...state.selectedIds])); }
function isSelected(video){ return state.selectedIds.has(video.video_id); }
function currentLangCode(){ return state.lang === "zh" ? "zh" : state.lang; }
function ensureSelection(){
  const visible = currentVideos();
  if (!visible.length) { state.overallIndex = 0; return; }
  const cur = currentVideo();
  if (!cur || !visible.some(v => v.video_id === cur.video_id)) {
    state.overallIndex = state.data.videos.findIndex(v => v.video_id === visible[0].video_id);
  }
}
function renderHeader(){
  $("pageTitle").textContent = t("title");
  $("pageSubtitle").textContent = `${t("subtitle")} ${state.data.ui[state.lang]?.disclaimer || state.data.ui.zh?.disclaimer || ""}`;
  $("headerSummary").textContent = `${state.data.stats.total_videos} videos · ${ex('selected')} ${state.selectedIds.size} · YouTube ${state.data.stats.youtube_uploaded_total}`;
  $("exportSelectedBtn").textContent = ex("export");
  $("clearSelectionBtn").textContent = ex("clear");
  $("exportSelectedBtn").disabled = state.selectedIds.size === 0;
  $("clearSelectionBtn").disabled = state.selectedIds.size === 0;
}
function renderFilters(){
  $("campaignFilters").innerHTML = ["all","guide","value","fun"].map(key => `<button class="filterBtn ${state.filter===key?'active':''}" onclick="selectFilter('${key}')">${ex(key)}</button>`).join("");
}
function renderLang(){
  $("lang").innerHTML = Object.entries(state.data.languages).map(([code, label]) => `<option value="${code}">${label}</option>`).join("");
  $("lang").value = state.lang;
  renderHeader();
  renderFilters();
  renderList();
  renderDetail();
}
function renderList(){
  ensureSelection();
  const visible = currentVideos();
  $("list").innerHTML = visible.map(v => {
    const overallIndex = state.data.videos.findIndex(item => item.video_id === v.video_id);
    const statusBadge = v.youtube_video_id
      ? `<span class="badge play">${ex('youtube')}</span>`
      : (v.platform === 'bilibili' ? `<span class="badge play">${ex('bilibili')}</span>` : `<span class="badge wait">${ex('pending')}</span>`);
    const selectedBadge = isSelected(v) ? `<span class="badge selected">${ex('selected')}</span>` : '';
    return `<button class="item ${overallIndex===state.overallIndex?'active':''}" onclick="selectVideo(${overallIndex})">
      <div class="checkWrap"><input class="pickBox" type="checkbox" ${isSelected(v) ? 'checked' : ''} onclick="event.stopPropagation()" onchange="toggleSelection('${v.video_id}')"></div>
      <div class="rank">#${v.rank}</div>
      <img class="thumb" src="${v.cover_site_path || ''}" alt="">
      <div class="meta">
        <div class="title">${localizedTitle(v)}</div>
        <div class="small">${v.author_name || ''} · ${ex(v.primary_campaign_category)} · ${fmt.format(Math.round(v.heat_score || 0))} ${ex('heat')}</div>
        <div class="badges"><span class="badge cat">${ex(v.primary_campaign_category)}</span>${statusBadge}${selectedBadge}</div>
      </div>
    </button>`;
  }).join("");
}
function sourceList(video){ return (video.player_sources || []).filter(s => (s.embed_url || s.url)); }
function pickSource(video){
  const sources = sourceList(video);
  if (!sources.length) return null;
  if (state.sourceType) {
    const match = sources.find(s => s.type === state.sourceType);
    if (match) return match;
  }
  return sources.find(s => s.type === video.default_player) || sources[0];
}
function renderSourceTabs(video, active){
  $("sourceTabs").innerHTML = sourceList(video).map(s => `<button class="sourceTab ${active && active.type===s.type?'active':''}" onclick="selectSource('${s.type}')">${s.label}</button>`).join("");
}
function clearSubtitle(){ $("subtitleText").textContent = ""; state.captions = []; }
function renderPlaceholder(message){ $("playerShell").innerHTML = `<div class="placeholder">${message}</div><div class="subtitleOverlay"><div class="subtitleText" id="subtitleText"></div></div>`; }
window.onYouTubeIframeAPIReady = () => { state.youtubeReady = true; if (pendingYoutubeId) loadYouTube(pendingYoutubeId); };
function ensurePlayerHost(){
  if (!document.getElementById("ytPlayer")) {
    $("playerShell").innerHTML = `<div id="ytPlayer"></div><div class="subtitleOverlay"><div class="subtitleText" id="subtitleText"></div></div>`;
    ytPlayer = null;
  }
}
function loadYouTube(videoId){
  pendingYoutubeId = videoId;
  ensurePlayerHost();
  if (!state.youtubeReady || !window.YT || !window.YT.Player) return;
  if (!ytPlayer) {
    ytPlayer = new YT.Player("ytPlayer", {
      videoId,
      playerVars: { rel:0, modestbranding:1, playsinline:1, cc_load_policy:0 },
      events: { onReady: () => updateSubtitle() }
    });
  } else if (ytPlayer.loadVideoById) {
    ytPlayer.loadVideoById(videoId);
  }
}
function parseTimecode(raw){
  const m = raw.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  return m ? Number(m[1])*3600 + Number(m[2])*60 + Number(m[3]) + Number((m[4]+"000").slice(0,3))/1000 : 0;
}
function parseSrt(text){
  return text.replace(/\r/g,"").split(/\n\s*\n/).map(block => {
    const lines = block.split("\n").filter(Boolean);
    const timeLine = lines.find(line => line.includes("-->"));
    if (!timeLine) return null;
    const [start, end] = timeLine.split("-->").map(x => x.trim());
    const idx = lines.indexOf(timeLine);
    return { start: parseTimecode(start), end: parseTimecode(end), text: lines.slice(idx + 1).join("\n").trim() };
  }).filter(Boolean);
}
function captionLang(){ return state.lang === 'zh' ? 'zh-Hans' : state.lang; }
async function loadCaptions(video, source){
  clearSubtitle();
  if (!source || source.type !== 'youtube') return;
  const url = `captions_full/${captionLang()}/${video.video_id}.srt`;
  state.captionUrl = url;
  try {
    const res = await fetch(url, { cache:'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    if (state.captionUrl !== url) return;
    state.captions = parseSrt(await res.text());
  } catch (e) {
    state.captions = [];
  }
}
function updateSubtitle(){
  const subtitleEl = document.getElementById("subtitleText");
  if (!subtitleEl || !ytPlayer || !ytPlayer.getCurrentTime || !state.captions.length) {
    if (subtitleEl) subtitleEl.textContent = "";
    return;
  }
  let current = 0;
  try { current = ytPlayer.getCurrentTime(); } catch (e) { return; }
  const cue = state.captions.find(item => current >= item.start && current < item.end);
  subtitleEl.textContent = cue ? cue.text : "";
}
setInterval(updateSubtitle, 250);
function formatStat(value){ return fmt.format(Number(value || 0)); }
function statItems(video){
  const s = video.platform_stats || {};
  if (video.platform === 'bilibili') {
    return [[ex('view'), s.view], [ex('like'), s.like], [ex('comment'), s.reply], [ex('share'), s.share], [ex('favorite'), s.favorite]];
  }
  return [[ex('like'), s.like || s.digg_count || 0], [ex('comment'), s.comment || s.comment_count || 0], [ex('share'), s.share || s.share_count || 0], [ex('collect'), s.collect || s.collect_count || 0], [ex('heat'), Math.round(video.heat_score || 0)]];
}
function renderPlayer(video, source){
  if (!source) {
    renderPlaceholder('No playable source yet.');
    return;
  }
  if (source.type === 'youtube' && video.youtube_video_id) {
    ensurePlayerHost();
    loadYouTube(video.youtube_video_id);
    return;
  }
  if (source.type === 'bilibili' && source.embed_url) {
    ytPlayer = null;
    $("playerShell").innerHTML = `<iframe src="${source.embed_url}" allowfullscreen></iframe><div class="subtitleOverlay"><div class="subtitleText" id="subtitleText"></div></div>`;
    return;
  }
  renderPlaceholder(`Playback source is pending.<br><a href="${video.source_url || '#'}" target="_blank" style="color:#8dc4ff;">Open original source</a>`);
}
function composeBrief(video){
  const bullets = localizedBullets(video);
  const lines = [
    `${ex('localTitle')}: ${localizedTitle(video)}`,
    `${ex('primaryCategory')}: ${ex(video.primary_campaign_category)}`,
    "",
    `${ex('analysis')}:`,
    ...bullets.map(item => `- ${item}`),
    "",
    `${ex('sourceField')}: ${video.source_url || ''}`,
  ];
  return lines.join("\n");
}
function composeBatchBrief(videos){
  return videos.map((video, idx) => {
    return [
      `====================`,
      `#${idx + 1}`,
      composeBrief(video)
    ].join("\n");
  }).join("\n\n");
}
async function copyText(text){
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch (err) {
      document.body.removeChild(ta);
      return false;
    }
  }
}
function downloadTextFile(text, filename){
  const blob = new Blob([text], { type:'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function sortedSelectedVideos(){ return state.data.videos.filter(v => state.selectedIds.has(v.video_id)).sort((a, b) => a.rank - b.rank); }
function renderDetail(){
  ensureSelection();
  const video = currentVideo();
  const source = pickSource(video);
  state.sourceType = source ? source.type : null;
  renderSourceTabs(video, source);
  renderPlayer(video, source);
  loadCaptions(video, source);
  $("playerStatus").textContent = source ? `${source.label} · ${video.youtube_video_id ? ex('playable') : ex('pending')}` : ex('pending');
  $("playbackNotice").textContent = video.playback_notice_zh || '';
  $("videoTitle").textContent = localizedTitle(video);
  $("videoMeta").textContent = `${ex('overall')} #${video.rank} · ${video.author_name || ''} · ${video.published_at_text || ''}`;
  $("stats").innerHTML = statItems(video).map(([label, val]) => `<div class="stat"><b>${formatStat(val)}</b><span>${label}</span></div>`).join('');
  $("briefLabel").textContent = `${ex('brief')} · ${ex('exportReady')}`;
  $("briefPreview").textContent = composeBrief(video);
  $("toggleBriefBtn").textContent = isSelected(video) ? ex('remove') : ex('add');
  $("copyBriefBtn").textContent = ex('copy');
  $("summaryLabel").textContent = ex('analysis');
  $("insightList").innerHTML = localizedBullets(video).map(item => `<li>${item}</li>`).join('');
  $("transcriptLabel").textContent = ex('transcript');
  $("transcriptPreview").textContent = (video.asr && video.asr.transcript_preview) || 'ASR transcript unavailable.';
  $("tagLabel").textContent = ex('tags');
  const tags = [`${ex(video.primary_campaign_category)}`].concat(localizedTags(video));
  $("tagChips").innerHTML = tags.map(tag => `<span class="tag">${tag}</span>`).join('');
  $("statusLabel").textContent = ex('status');
  $("statusText").innerHTML = [
    `YouTube: ${video.youtube_upload_status || 'pending'}`,
    `Subtitles: ${video.youtube_caption_status || ''}`,
    `Playback: ${video.playback_status || ''}`
  ].join('<br>');
  const captionHref = `captions_full/${captionLang()}/${video.video_id}.srt`;
  const links = [`<a href="${video.source_url}" target="_blank">${ex('source')}</a>`, `<a href="${captionHref}" target="_blank">${ex('caption')}</a>`];
  if (video.youtube_watch_url) links.unshift(`<a href="${video.youtube_watch_url}" target="_blank">YouTube</a>`);
  $("links").innerHTML = links.join('');
}
window.selectFilter = (key) => { state.filter = key; ensureSelection(); renderFilters(); renderList(); renderDetail(); };
window.selectVideo = (overallIndex) => { state.overallIndex = overallIndex; renderList(); renderDetail(); };
window.selectSource = (type) => { state.sourceType = type; renderDetail(); };
window.toggleSelection = (videoId) => {
  if (state.selectedIds.has(videoId)) state.selectedIds.delete(videoId);
  else state.selectedIds.add(videoId);
  saveSelection();
  renderHeader();
  renderList();
  renderDetail();
};
$("lang").addEventListener("change", (e) => {
  state.lang = e.target.value;
  localStorage.setItem("lang", state.lang);
  renderLang();
});
$("copyBriefBtn").addEventListener("click", async () => {
  const ok = await copyText(composeBrief(currentVideo()));
  if (ok) $("copyBriefBtn").textContent = ex('copied');
  setTimeout(() => { $("copyBriefBtn").textContent = ex('copy'); }, 1200);
});
$("toggleBriefBtn").addEventListener("click", () => { toggleSelection(currentVideo().video_id); });
$("clearSelectionBtn").addEventListener("click", () => {
  state.selectedIds = new Set();
  saveSelection();
  renderHeader();
  renderList();
  renderDetail();
});
$("exportSelectedBtn").addEventListener("click", () => {
  const videos = sortedSelectedVideos();
  if (!videos.length) { alert(ex('noSelection')); return; }
  downloadTextFile(composeBatchBrief(videos), `fortune-run-brief-${currentLangCode()}-${videos.length}.txt`);
});
fetch('data/videos.json').then(r => r.json()).then(data => {
  state.data = data;
  renderLang();
});
