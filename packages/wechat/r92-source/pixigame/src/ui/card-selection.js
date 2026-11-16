// Selection is separate from rarity and equipped/active status.
export const cardSelection = selected => selected
  ? '<span class="card-selection" aria-hidden="true"><i></i><i></i><i></i><i></i><em>选中</em></span>'
  : '';
