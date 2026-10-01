import { Component, inject, signal, viewChild } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CarritoService } from '../../services/carrito-service';
import { AuthService } from '../../services/auth-service';
import { ProductoService } from '../../services/producto-service';
import { NotificacionService } from '../../services/notificacion-service';
import { VentaService } from '../../services/venta-service';
import { stockDisponibleValidator } from '../../core/validators/stock.validator';
import { Captcha } from '../../components/captcha/captcha';

@Component({
  selector: 'app-checkout',
  imports: [ReactiveFormsModule, Captcha],
  templateUrl: './checkout.html',
})
export class Checkout {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private ventaService = inject(VentaService);

  carritoService = inject(CarritoService);
  authService = inject(AuthService);
  productoService = inject(ProductoService);
  notificacionService = inject(NotificacionService);

  private captcha = viewChild(Captcha);

  procesando = signal(false);
  captchaToken = signal('');
  errorPago = signal('');

  // Con Stripe Checkout el formulario se queda solo con el envio: la
  // tarjeta se teclea en la pagina de Stripe y nunca pasa por aqui.
  checkoutForm = this.fb.group(
    {
      envio: this.fb.group({
        nombreCompleto: ['', [Validators.required, Validators.minLength(5)]],
        direccion: ['', [Validators.required, Validators.minLength(8)]],
        ciudad: ['Lima', Validators.required],
        usarOtraDireccion: [false],
        direccionAlternativa: [{ value: '', disabled: true }, Validators.required],
      }),
    },
    {
      // Antes de mandar a pagar, el servidor dice si aun hay stock.
      asyncValidators: [stockDisponibleValidator(this.productoService, this.carritoService)],
    },
  );

  get envio() {
    return this.checkoutForm.get('envio');
  }

  get nombreCompleto() {
    return this.checkoutForm.get('envio.nombreCompleto');
  }

  get direccion() {
    return this.checkoutForm.get('envio.direccion');
  }

  get direccionAlternativa() {
    return this.checkoutForm.get('envio.direccionAlternativa');
  }

  constructor() {
    // El campo de la otra direccion solo se habilita si marcan la casilla.
    this.checkoutForm.get('envio.usarOtraDireccion')?.valueChanges.subscribe((usar) => {
      const campo = this.direccionAlternativa;

      if (usar) {
        campo?.enable();
      } else {
        campo?.reset('');
        campo?.disable();
      }
    });
  }

  alGenerarToken(token: string) {
    // El mensaje de error no se limpia aqui: al reiniciar el widget llega
    // un token nuevo enseguida y borraria el aviso antes de leerlo.
    this.captchaToken.set(token);
  }

  alFallarCaptcha() {
    this.captchaToken.set('');
    this.errorPago.set('El captcha no cargo bien, recarga la pagina.');
  }

  pagar() {
    if (this.checkoutForm.pending) {
      this.notificacionService.show('Espera, estamos verificando el stock', 'info');
      return;
    }

    if (this.checkoutForm.invalid) {
      this.checkoutForm.markAllAsTouched();
      this.notificacionService.show('Revisa los datos de envio', 'error');
      return;
    }

    if (this.carritoService.items().length === 0) {
      this.notificacionService.show('Tu carrito esta vacio', 'error');
      return;
    }

    if (!this.captchaToken()) {
      this.notificacionService.show('Resuelve el captcha para continuar', 'error');
      return;
    }

    const datos = this.envio!.value as {
      nombreCompleto: string;
      direccion: string;
      usarOtraDireccion: boolean;
      direccionAlternativa: string;
    };

    this.procesando.set(true);
    this.errorPago.set('');

    this.ventaService
      .crearCheckout(
        this.carritoService.items(),
        {
          nombreCompleto: datos.nombreCompleto,
          // Si marcaron la casilla se envia a la otra direccion.
          direccion: datos.usarOtraDireccion ? datos.direccionAlternativa : datos.direccion,
        },
        this.captchaToken(),
      )
      .subscribe({
        // Stripe Checkout es una pagina externa, no una ruta de Angular:
        // por eso se sale con window.location y no con el Router.
        next: ({ url }) => {
          window.location.href = url;
        },
        error: (error: HttpErrorResponse) => {
          this.procesando.set(false);
          // El token de Turnstile se usa una sola vez: si el pago no
          // salio hay que pedir uno nuevo.
          this.captcha()?.reiniciar();
          this.errorPago.set(error.error?.error ?? 'No se pudo iniciar el pago, intenta de nuevo.');
        },
      });
  }

  volverAlCarrito() {
    this.router.navigate(['/carrito']);
  }
}
