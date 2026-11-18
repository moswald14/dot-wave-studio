(function(){
  'use strict';let database;
  async function open(){if(!window.indexedDB)throw new Error('Browser storage is unavailable.');if(!database)database=new Promise((resolve,reject)=>{const request=indexedDB.open('dot-wave-studio',1);request.onupgradeneeded=()=>request.result.createObjectStore('studio');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});return database;}
  async function get(key){const db=await open();return new Promise((resolve,reject)=>{const request=db.transaction('studio','readonly').objectStore('studio').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
  async function put(key,value){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('studio','readwrite');tx.objectStore('studio').put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Browser storage stopped.'));});}
  window.StudioStore={get,put};
})();
