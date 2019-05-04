function setLocalSotrage(key, val) {
    localStorage.setItem(key, val);
}

function getLocalStorage(key) {
    return localStorage.getItem(key);
}

function removeLocalStorage(key) {
    localStorage.removeItem(key);
}

function removeAllLocalStorage() {
    localStorage.clear();
}

function bkLocalStorage() {
    var _bkLocalStorage = [];
    Object.keys(localStorage).forEach(function (key) {
        if (key != '::app3_sys_backup') {
            _bkLocalStorage.push({
                id: key,
                content: localStorage.getItem(key)
            });
        }
    });
    console.log(_bkLocalStorage);
    localStorage.setItem('::app3_sys_backup', JSON.stringify(_bkLocalStorage));
    localStorage.setItem('::app3_sys_backup_time', new Date());
}

function resotreLocalSotrage() {
    const _dataRestore = JSON.parse(localStorage.getItem('::app3_sys_backup'));
    _dataRestore.map(x => {
        // if (x.id === '::app3_sys_backup_time') return;
        // if (x.id === '::app3_sys_backup') return;

        if ( !localStorage.getItem(x.id) ) {
            setLocalSotrage(x.id, x.content);
        }
    });
}