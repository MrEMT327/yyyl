import { recordDiagnostic } from '../diagnostic-log.js';

export function pilotVideoMarkup(source, label, escape) {
  return `<video class="bc-affection-video" aria-label="${escape(label)}" src="${escape(source)}" playsinline autoplay disablepictureinpicture disableremoteplayback preload="metadata"></video>
    <div class="bc-affection-video-controls" role="group" aria-label="视频播放控制">
      <button type="button" class="bc-affection-video-toggle" aria-label="播放"></button>
      <input type="range" class="bc-affection-video-seek" aria-label="播放进度" min="0" max="0" value="0" step="any" disabled>
      <span class="bc-affection-video-time">0:00 / 0:00</span>
      <button type="button" class="bc-affection-video-mute" aria-label="静音" aria-pressed="false"></button>
    </div>`;
}

function formatVideoTime(seconds) {
  const wholeSeconds = Math.floor(seconds);
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
}

export function mountPilotVideoControls(host) {
  const video = host.querySelector('.bc-affection-video');
  if (!video) return;
  const toggle = host.querySelector('.bc-affection-video-toggle');
  const seek = host.querySelector('.bc-affection-video-seek');
  const time = host.querySelector('.bc-affection-video-time');
  const mute = host.querySelector('.bc-affection-video-mute');

  function updateProgress() {
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    seek.disabled = duration <= 0;
    seek.max = String(duration);
    const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    seek.value = String(currentTime);
    time.textContent = `${formatVideoTime(currentTime)} / ${formatVideoTime(duration)}`;
  }
  function updatePlayback() {
    const playing = !video.paused && !video.ended;
    toggle.toggleAttribute('data-playing', playing);
    toggle.setAttribute('aria-label', playing ? '暂停' : video.ended ? '重播' : '播放');
  }
  function updateMute() {
    mute.setAttribute('aria-pressed', String(video.muted));
  }

  toggle.addEventListener('click', () => {
    if (video.paused || video.ended) video.play().catch(updatePlayback);
    else video.pause();
  });
  seek.addEventListener('input', () => {
    video.currentTime = Number(seek.value);
    updateProgress();
  });
  mute.addEventListener('click', () => { video.muted = !video.muted; });
  video.addEventListener('contextmenu', event => event.preventDefault());
  video.addEventListener('playing', () => recordDiagnostic('专属视频开始播放'), { once: true });
  video.addEventListener('ended', () => recordDiagnostic('专属视频播放结束'));
  video.addEventListener('error', () => {
    recordDiagnostic('专属视频加载失败', video.error?.code);
    time.textContent = '加载失败';
    toggle.setAttribute('aria-label', '重试播放');
  });
  video.addEventListener('volumechange', updateMute);
  for (const type of ['play', 'pause', 'ended']) video.addEventListener(type, updatePlayback);
  for (const type of ['loadedmetadata', 'durationchange', 'timeupdate']) video.addEventListener(type, updateProgress);
  updatePlayback();
  updateProgress();
  updateMute();
}
