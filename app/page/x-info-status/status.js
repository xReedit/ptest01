window.onload = () => {    
    this.checkAlertServicio();

    // click boton cerrar
    var btn = document.getElementById('btnStatusNext');
    btn.addEventListener('click', function() {
        urlNext();
    });
}

function checkAlertServicio() {
                console.log('CHECK ALERT SERVICIO');
                try {
                    fetch('../../../bdphp/api.php?route=get-check-alert-service', {
                        method: 'GET'
                    })
                        .then(response => response.json())
                        .then(data => {
                            console.log('data', data);
                            if (data.mostrar) {                                
                                $('body').addClass('loaded');                                
                                // this.xisNotificaPagar = true;
                                $('#msjadicional').text(data.msj);
                                // this.isshowclose = data.isshowclose;
                                this.numsecondst = data.tiempo;
                                if ( data.tiempo === 1000 ) { return;}
                                var btn = document.getElementById('btnStatusNext');
                                btn.disabled = true;
                                var countdown = setInterval(function() {
                                    if (this.numsecondst <= 0) {
                                        clearInterval(countdown);
                                        btn.disabled = false;
                                        btn.textContent = "Continuar";
                                        localStorage.setItem('::app3_woDataCheck', '1');
                                    } else {
                                        btn.textContent = "Continuar en " + this.numsecondst + " segundos";
                                        this.numsecondst--;
                                    }
                                }, 1000);
                                // this.titlebtncerra = data.titlebtncerra;
                                
                            } else {
                                setTimeout(() => {                                    
                                    urlNext();
                                }, 100);
                            }
                        }).catch(error => {
                            console.error('error', error);
                            urlNext();
                        });
                } catch (error) {
                    console.log(error);
                    urlNext();
                }

            }

function urlNext() {
    window.location = '../m_panel.html';
}

