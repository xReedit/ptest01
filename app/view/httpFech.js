class httpFecht {    
    
    
    async postJson(url, params) {
        return await this.fetchData(url, {
            method: 'POST',
            body:JSON.stringify(params)
          });
    }


    fetchData = async (url, options = {}) => {
        return await fetch(url, {
            headers: {
                'Content-Type': 'application/json'
              },            
            ...options,
        })
        // .then(res => res.json());   
        .then(res => {
            if (!res.ok) {
                console.log('error', res.statusText);
                throw new Error('Network response was not ok', res.statusText);
            }
            return res.text();
        })
        .then(data => {
            if (data === "") {
                console.log('error', data);
                throw new Error('Empty response from server');
            }
            return JSON.parse(data);
        });     
      };

    ajaxPost(url) {
        $.ajax({ type: 'POST', url, data: {p_from:'z'}})
            .done((aa) => {
                // console.log( 'res ajax', aa)
            });
    }

    // implemta una funcion que utilize axios para hacer peticiones
    // tambien que maneje errores, si no hay conexion a internet o hay error que lo vuelva a intentar hasta por 3 veces
    // si no se puede que muestre un mensaje de error

    async axiosPost(params) {
        return await axios(params)
            .then(response => {
                // retorna los datos en formato json
                return response.data;
            })
    }    

    // params.isShowPreload = true;
    axiosExecute = async (params, isHeadersJson = false, respondeString = true, retry = 3) => {
        
        // antes de ejecutar la peticion primero chequeamos checkSessionCookie
        // si no hay cookie de session entonces no ejecutamos la peticion
        if (!this.checkSessionCookie()) {
            const _error = {
                message: 'La session ha expirado, Trataré de recuperar la session. Por favor itente nuevamente en unos segundos. Sino debe cerrar la aplicación y volver a iniciarla.'
            }
            this.manejoErrorPetitionHttp(_error);
            updateConnectionStatusFocus();
            return false;
        }


        params.method = params.type || params.method;
        delete params.type;      
        
        const isShowPreload = params.isShowPreload === undefined ? true : params.isShowPreload;
        // si existe la propiedad isShowPreload la eliminamos del objeto params        
        delete params.isShowPreload;
        

        params.headers = {
            'Content-Type':  isHeadersJson ? 'application/json' : 'application/x-www-form-urlencoded'
        };            

        xPopupLoad.titulo="Cargando...";

        if(isShowPreload == true) {
            xPopupLoad.xopen();
        }


        return new Promise((resolve, reject) => {
            const attempt = async () => {
                try {
                    const response = await this.axiosPost(params);
                    resolve(respondeString ? JSON.stringify(response) : response);
                } catch (error) {
                    if (retry > 0) {
                        setTimeout(() => attempt(--retry), 2000);
                    } else {                        
                        this.manejoErrorPetitionHttp(error);                        
                        reject(error);  
                        throw error;                      
                    }
                } finally {
                    xPopupLoad.xclose();
                }
            };
            attempt();
        });

    }

    // devuelve por defecto JSON
    axiosExecuteJSON = async (params) => {
        let isHeadersJson = true;
        let respondeString = false;        
        return await this.axiosExecute(params, isHeadersJson, respondeString);        
    }

    // function que lanza un mensaje de error si no hay conexion a internet o cuando hay un error en la peticion
    manejoErrorPetitionHttp = (error) => {               
        xPopupLoad.xclose();
        
        let _htmlMsjError = '';
        switch (error.message) {
            case 'Network Error':
                _htmlMsjError = `<i class="fa fa-plug fa-2x text-danger" aria-hidden="true"></i>
                                <p class="fw-600 fs-20">Sin Conexión a internet</p>
                                <p class="fw-100 fs-14">Verifique su conexión a internet y vuelva a intentarlo.</p>`;
                break;
            default:

                _htmlMsjError = `<i class="fa fa-plug fa-2x text-danger" aria-hidden="true"></i>
                                <p class="fw-600 fs-20">Up! ocurrio un error!</p>
                                <p class="fw-100 fs-14">No pudimos procesar la socilitud. Vuelva a intentarlo nuevamente.</p>
                                <p class="fw-100 fs-12 text-warning">${error.message}.</p>`;
                                
                break;
        }

        // lanzar un mensaje con mi.sweet.alert
        const _swalAlertValues = paramsSwalAlert;
        _swalAlertValues.html = `<div class="p-1">${_htmlMsjError}</div>`;
        showAlertSwalHtml(_swalAlertValues);
    }

    checkSessionCookie = () => {
        const cookies = document.cookie.split(';');
        for(let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.startsWith('PHPSESSID=')) {
                return true;
            }
        }
        return false;
    }

    
    
}