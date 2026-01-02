import {DEBUGGING} from "./constants.js";

export function debug(msg, enabled = DEBUGGING){
    if (enabled){
        console.log(msg);
    }
}