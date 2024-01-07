/// _socketSuperMaster se declara en xm_all.js


class socketService {
    static instance = null;

    dataSocket = {};
    _socket = _socketSuperMaster;
    _idConexSocket;

    //  _socketEventSubject = new BehaviorSubject(null);

    isSocketConnectSource = new rxjs.BehaviorSubject(false);
    isSocketConnect$ = this.isSocketConnectSource.asObservable();

    isRegistroVentaSource = new rxjs.BehaviorSubject(false);
    isRegistroVenta$ = this.isRegistroVentaSource.asObservable();

    constructor() {
        // this.connectSocket();

        if (socketService.instance) {
            return socketService.instance;
        }

        socketService.instance = this;

    }

    static getInstance() {
        if (!socketService.instance) {
            console.log('new socket services');
            socketService.instance = new socketService();
        }
        return socketService.instance;
    }

    connectSocket(){
        
        // verificar si hay una conexion activa con estos datos dataSocket
        this._idConexSocket = localStorage.getItem('app3_us_skt') || '';
        
        
        this.getDataClient();
        
        if ( this._socket && this._socket.connected)  {
            // this.whenSocketIsConnect();
            return this._socket;
        }

        this._socket = io.connect(URL_SOCKET, {
            query: this.dataSocket
        });

        this.whenSocketIsConnect();
        this.isSocketConnectSource.next(true);
    }

    whenSocketIsConnect() { // cuando esta conectado
        this.listenStatus();

        console.log('socket master connect'); 
        _socketSuperMaster = this._socket;        
    }

    disconnectSocket() {
        this._socket.disconnect();
        console.log('socket master disconnect'); 
        _socketSuperMaster = null;
    }

    getDataClient() {
        const dtUs = xm_log_get('app3_us');
        this.dataSocket = {
            idorg: dtUs.ido,
            idsede: dtUs.idsede,
            idusuario: dtUs.idus,
            // socketid: this._idConexSocket,
            isFromApp: 0
        }
    }

    emit(evento, payload = null) {
        this._socket.emit(evento, payload)
    }

    listen(evento) {
        return new rxjs.Observable(observer => {
            this._socket.on(evento, (res) => {                
                observer.next(res);
            });
        })
        // .pipe(
        //     rxjs.take(1),
        //     rxjs.retry(2)            
        // );
    }

    _listen(evento, callback) {
        this._socket.on(evento, callback);
    }

    // getSocketEventObservable() {
    //     return this._socketEventSubject.asObservable();
    // }

    listenStatus() {
        // escuchamos los cambios del navegador
        window.addEventListener('online', () => {
            this.statusConexSocket(true, 'navigator_online');
            xm_all_xToastOpen('Conexion Recuperada', 2000, false);
        });
        window.addEventListener('offline', () => {
           this.statusConexSocket(false, 'navigator_offline');
            xm_all_xToastOpen('Sin Conexion a internet', 20000, true, true);
        });

        // escuchamos los cambios de conexion en el socket
        this._socket.on('connect', () => {
            console.log('socket connect');
          this.statusConexSocket(true, 'connect');
          localStorage.setItem('app3_us_skt', _socketSuperMaster.id);

        //  xm_all_xToastOpen('Conexion Recuperada', 2000);
        });

        this._socket.on('connect_failed', (res) => {
          console.log('itento fallido de conexion', res);
          this.statusConexSocket(false, 'connect_failed');
        });
    
        this._socket.on('connect_error', (res) => {
          console.log('error de conexion', res);
          this.statusConexSocket(false, 'connect_error');
        });
    
        this._socket.on('disconnect', (res) => {
            console.log('desconectado', res);
          this.statusConexSocket(false, 'disconnect');
        });
    }

    statusConexSocket(isConncet, evento) {
        this.isSocketConnectSource.next(isConncet);        
    }    

    onStatusConexSocket() {
        return new rxjs.Observable(observer => {
            this.isSocketConnect$.subscribe(res => {
                observer.next(res);
            });        
        });
    }

}

