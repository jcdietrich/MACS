import {DEBUGGING} from "./constants.js";

export function debug(msg){
    if (DEBUGGING){
        console.log(msg);
    }
}