import {startLobbySession} from './host-session.js';
import {mountPeripheralLobby} from '../ui/peripheral-lobby.js';
import {createReplicaBattleBridge} from '../replica/battle-bridge.js';
export function startNativeLobbyHost(options){return startLobbySession({mountLobby:mountPeripheralLobby,createBattle:createReplicaBattleBridge,...options});}
