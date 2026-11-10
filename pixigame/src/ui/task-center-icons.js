const base=import.meta.env?.BASE_URL??'/';
export const TASK_CLAIMED_IMAGE=`${base}art/project-signin-icons-v2/claimed.png`;
export function taskStatusMark(label='已完成') {
  return `<button type="button" class="wc-button dc-button dc-task-status" disabled>${label}</button>`;
}
export function taskActionArt(kind) {
  if(kind==='claim')return `<svg class="dc-task-button-icon is-claim" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M12 3v11m-4-4 4 4 4-4M4 15v5h16v-5" fill="none" stroke="#42657d" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 3v11m-4-4 4 4 4-4M4 15v5h16v-5" fill="none" stroke="#eaf5fc" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const file=kind==='go'?'project-ui-icons-v1/chevron-right.png':'project-ui-icons-v1/lock.png';
  return `<img class="dc-task-button-icon" src="${base}art/${file}" alt="" aria-hidden="true" draggable="false">`;
}
