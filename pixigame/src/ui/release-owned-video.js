// Unlike a modal's temporary pause, evicting a portrait permanently retires
// every clip it owns, including clips whose video never joined the DOM.
export const RELEASE_OWNED_VIDEO = Symbol.for('shnh.releaseOwnedVideo');

export function releaseOwnedVideo(video) {
  if (video[RELEASE_OWNED_VIDEO]) video[RELEASE_OWNED_VIDEO]();
  else {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
}
