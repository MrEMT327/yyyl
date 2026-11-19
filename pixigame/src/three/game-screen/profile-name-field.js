import {createTextField} from './text-field.js';

export function createNameField(surface,value,changed,submit,cancel,repaint){
  return createTextField(surface,value,()=>changed(),submit,cancel,repaint,{label:'玩家名字',maxLength:24});
}
