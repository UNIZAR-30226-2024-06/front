import { Component, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterOutlet, RouterModule, Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { promises } from 'node:dns';
import { consumerPollProducersForChange } from '@angular/core/primitives/signals';
import fs from 'fs';

@Component({
  selector: 'app-edit-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterModule],
  templateUrl: './edit-perfil.component.html',
  styleUrl: './edit-perfil.component.css'
})
export class EditPerfilComponent {
  edades: number[] = Array.from({length: 82}, (_, i) => i + 18);
  mostrarContrasena = false;
  @ViewChild('fileInput') fileInput!: ElementRef;
  imagenPerfil = 'assets/Logo.png'; //Quiza aqui traer la de la BD
  usuario: any = { idlocalidad: 1 };
  error: string='';
  flag_imagen = false;
  file: any;

  provincias = [
    'Álava', 'Albacete', 'Alicante', 'Almería', 'Asturias', 'Ávila', 'Badajoz', 'Baleares', 'Barcelona', 'Burgos',
    'Cáceres', 'Cádiz', 'Cantabria', 'Castellón', 'Ceuta', 'Ciudad Real', 'Córdoba', 'Cuenca', 'Gerona',
    'Granada', 'Guadalajara', 'Guipúzcoa', 'Huelva', 'Huesca', 'Jaén', 'La Coruña', 'La Rioja', 'Las Palmas',
    'León', 'Lérida', 'Lugo', 'Madrid', 'Málaga', 'Melilla', 'Murcia', 'Navarra', 'Orense', 'Palencia',
    'Pontevedra', 'Salamanca', 'Santa Cruz de Tenerife', 'Segovia', 'Sevilla', 'Soria', 'Tarragona', 'Teruel',
    'Toledo', 'Valencia', 'Valladolid', 'Vizcaya', 'Zamora', 'Zaragoza'
  ];

  toggleMostrarContrasena() {
    this.mostrarContrasena = !this.mostrarContrasena;
  }

  actualizarEdadMaxima() {
    if (this.usuario.buscaedadmin > this.usuario.buscaedadmax) this.usuario.buscaedadmax = this.usuario.buscaedadmin;
  }

  actualizarEdadMinima() {
    if (this.usuario.buscaedadmin > this.usuario.buscaedadmax) this.usuario.buscaedadmin = this.usuario.buscaedadmax;
  }


  cambiarImagen(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const fileName = file.name.toLowerCase();
      const validExtensions = ['jpg', 'jpeg', 'png'];
      const fileExtension = fileName.split('.').pop();
  
      if (fileExtension && validExtensions.includes(fileExtension)) {
        this.file = input.files[0];
        const reader = new FileReader();
        reader.onload = () => {
          this.imagenPerfil = reader.result as string; // Almacena la URL del archivo multimedia
        };
        reader.readAsDataURL(file);
        this.flag_imagen = true;
      } else {
        alert('Solo se permiten archivos de tipo JPG o PNG.');
  
      }
    }
  }

  constructor(private http: HttpClient, private router: Router) {
    this.obtenerPerfilUsuario();
  }

  async obtenerPerfilUsuario(): Promise<void> {
    const headers = new HttpHeaders({
      'Authorization': 'Bearer ' + localStorage.getItem('token')
    });
  
    const response = await this.http.get<any>('http://'+environment.host_back+'/user/profile', { headers: headers }).toPromise();
    try {
      console.log(response);
      this.usuario = response;
      if (this.usuario.idlocalidad >= 1 && this.usuario.idlocalidad <= this.provincias.length) {
        this.usuario.localidad = this.provincias[this.usuario.idlocalidad - 1];
      } 
      else {
        this.usuario.localidad = 'Desconocido';
      }
      const image = await fetch('http://'+environment.host_back+'/multimedia/' + this.usuario.fotoperfil);
      const blob = await image.blob();
      const objectURL = URL.createObjectURL(blob);
      this.imagenPerfil = this.usuario.fotoperfil === 'null.jpg' ? this.imagenPerfil : objectURL;
    }
    catch (error: any) {
      console.error('Error al obtener el perfil del usuario', error);
      this.error = 'Error al obtener el perfil del usuario';
    }
  }
  
  usuarioActualizado: any = {}; // Nuevo objeto para almacenar los cambios antes de enviarlos al servidor

  actualizarUsuario(): void {
    // Actualizar el objeto usuarioActualizado con los valores del formulario
    this.usuarioActualizado = {
    correo: this.usuario.correo,
    nombre: this.usuario.nombre,
    edad: parseInt(this.usuario.edad, 10),
    sexo: this.usuario.sexo,
    buscaedadmin: parseInt(this.usuario.buscaedadmin, 10),
    buscaedadmax: parseInt(this.usuario.buscaedadmax, 10),
    buscasexo: this.usuario.buscasexo,
    descripcion: this.usuario.descripcion,
    fotoperfil: this.usuario.fotoperfil,
    idlocalidad: parseInt(this.usuario.idlocalidad, 10),
    };
  }

  async guardarCambios(): Promise<void> {
    const headers = new HttpHeaders({
      'Authorization': 'Bearer ' + localStorage.getItem('token')
    });
    this.actualizarUsuario();

    const idUsuario = this.usuario.id;
    
    console.log(this.file);
    if (this.flag_imagen == true) {
      const formData = new FormData();
      formData.append('file',this.file);
      try {
        const response = await this.http.post<any>('http://'+environment.host_back+'/multimedia/upload/foto/'+idUsuario, formData, { headers: headers }).toPromise();
        console.log('Imagen subida', response);
        //alert("Imagen subida");
        // Actualizar el objeto usuario con los cambios antes de enviarlos al servidor
        this.usuarioActualizado.fotoperfil = response.nombreArchivo;
      }
      catch (error: any) {
        console.error('Error al subir la imagen', error.message);
        this.error = error.error.error;
        alert(error.message); 
      }
    }

    const body= this.usuarioActualizado; // Enviar el objeto usuarioActualizado al backend
    console.log(body);

    this.http.put<any>('http://'+environment.host_back+'/user/update', body, { headers: headers })
      .subscribe(
        response => {
          console.log('Usuario actualizado', response);
          this.router.navigate(['/']);
        },
        error => {
          console.error('Error al actualizar el usuario', error.message);
          this.error = error.error.error;
        }
      );
  }
}
