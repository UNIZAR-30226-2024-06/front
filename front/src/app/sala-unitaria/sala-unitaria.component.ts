import { Component, ViewChild, OnDestroy, OnInit, inject,AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CabeceraYMenuComponent } from '../cabecera-y-menu/cabecera-y-menu.component';
import { YoutubeComponent } from '../youtube/youtube.component';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterOutlet, RouterModule, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../environments/environment';
import { SocketService } from '../../services/socket.service';
import { socketEvents } from '../../environments/socketEvents';
import { OrderByPipe } from '../../services/pipe';
import { Subscription, first } from 'rxjs';
import { YouTubePlayer, YouTubePlayerModule } from '@angular/youtube-player';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sala',
  standalone: true,
  imports: [CabeceraYMenuComponent, CommonModule, FormsModule, RouterOutlet, RouterModule, YouTubePlayerModule, OrderByPipe],
  //providers: [SocketService], Comentado para asegurar el patron singleton
  templateUrl: './sala-unitaria.component.html',
  styleUrls: ['./sala-unitaria.component.css']
})
export class SalaUnitariaComponent implements OnInit {
  @ViewChild(YouTubePlayer, { static: false }) youtubePlayer!: YouTubePlayer;
  playerVars = {
    autoplay: 1,  // 0 o 1 (1 significa autoplay activado)
    controls: 1,  // 0 o 1 (1 muestra los controles del reproductor)
    modestbranding: 1, // 1 para minimizar la marca de YouTube en el reproductor
    enablejsapi: 1,  // 1 permite la interacción con el API de JavaScript
    fs: 1,  // 0 o 1 (1 permite el botón de pantalla completa)
    iv_load_policy: 3, // 1 o 3 (3 para no mostrar anotaciones en el video)
  };
  roomId: string = '';
  videoUrl!: SafeResourceUrl;
  videoId: string = '';
  segundos: number = 0;
  messages: { text: string, multimedia: string, timestamp: number, isOwnMessage: boolean }[] = [];
  newMessage: string = '';
  subscriptions: Subscription[] = [];
  player: any;
  sala: string = '';

  //Variables traidas del componente youtube
  showResults = false;
  searchQuery: string = '';
  videos: any[] = [];
  errorMessage: string = '';

  enPausa: boolean = false;
  playerReady: boolean = false;
  msgId: any;
  timeStamp: number = 0;

  //private socketService: SocketService = inject(SocketService);

  constructor(private route: ActivatedRoute, private sanitizer: DomSanitizer, private router: Router, private socketService: SocketService, private http: HttpClient) { } 

  ngOnInit(): void {
    this.socketService.connect();
    
    const videoIdAux = localStorage.getItem('videoId');
    this.videoId = String(videoIdAux);
    this.route.params.subscribe(params => {
      this.sala = params['id'];
      console.log('Sala ID actualizado:', this.sala);
    });
    this.joinRoom();
}

  onPlayerReady(): void {
    this.youtubePlayer.playVideo();
    this.playerReady = true;  // Actualiza el estado cuando el reproductor esté listo
    console.log('Player ready event received');
  }

  applyVideoSettings(idVideo: string, timesegundos: number, pausado: boolean): void {
    this.videoId = idVideo;
    this.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl('https://www.youtube.com/embed/' + idVideo);
    this.updateVideoPlayer(this.videoId);
    this.youtubePlayer.seekTo(timesegundos, true);

    if (pausado) {
      this.youtubePlayer.pauseVideo();
    } else {
      this.youtubePlayer.playVideo();
    }
  }

  joinRoom(): void {
    this.socketService.emitJoinLeave(socketEvents.JOIN_ROOM, this.sala); // Asegúrate de implementar esta funcionalidad en el servidor
  }


  onStateChange(event: any): void {
    console.log('YouTube Player state changed', event.data);
    if (event.data === YT.PlayerState.PLAYING) {
      console.log('PLAY event received and video played');
      this.playVideo();
      this.enPausa = false;
    } else if (event.data === YT.PlayerState.PAUSED) {
      console.log('PAUSE event received and video paused');
      this.pauseVideo();
      this.enPausa = true;
    }
  }

  // Emite un evento PAUSE al servidor para informar que el usuario ha pausado el video
  pauseVideo(): void {
    this.enPausa = true;
    this.socketService.emitPlayPause(socketEvents.PAUSE, this.sala);
    console.log('Evento PAUSE emitido');
    if (/^\d+$/.test(this.sala)) {
      this.mandarTiempo(this.youtubePlayer.getCurrentTime());
    }
  }

  // Emite un evento PAUSE al servidor para informar que el usuario ha pausado el video
  playVideo(): void {
    this.enPausa = false;
    this.socketService.emitPlayPause(socketEvents.PLAY, this.sala);
    console.log('Evento PLAY emitido');
  }

  mandarTiempo(segundos: number){
    this.socketService.emitTiempo(socketEvents.STORE_TIME, this.sala, segundos);
  }

  toggleResults() {
    this.showResults = !this.showResults;
  }
  searchVideos() {
    if (this.searchQuery.trim() === '') {
      this.errorMessage = 'No ha escrito nada para su búsqueda';
      return;
    }
    this.errorMessage = '';
    const apiKey = environment.apiKey;
    const apiUrl = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&part=snippet&type=video&q=${this.searchQuery}&maxResults=50`;

    this.http.get(apiUrl).subscribe((data: any) => {
      this.videos = data.items;
      this.showResults = true;
    });
  }

  changeVideo(videoId2: string){
      this.socketService.disconnect();
      this.videoId = videoId2;
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`
      });
      this.socketService.connect();
      this.http.post(`http://`+environment.host_back+`/videos/watch/${videoId2}`, {}, { headers: headers }).subscribe(
        async (response: any) => {
          console.log(headers);
          localStorage.setItem('videoId', videoId2);
          if(response.esSalaUnitaria == true) {
            this.router.navigate(['/salaUnitaria', videoId2]);
            this.socketService.onMatchEvent(socketEvents.MATCH).subscribe({
              next: (data) => {
                this.router.navigate(['/sala', data.idSala]);
                console.log('Match event received:', data);
                console.log(`Match confirmed between senderId: ${data.senderId} and receiverId: ${data.receiverId} in room: ${data.idSala}`);
              },
              error: (err) => console.error(err),
              complete: () => console.log('Finished listening to MATCH events')
            }); 
          } else {
            await this.delay(1000); // Espera de 1 segundo
            this.router.navigate(['/sala', response.idsala]);
          }
        },
        (error: any) => {
          console.error(error);
          this.errorMessage = error.error.error;
        }
      );
  }

  async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  updateVideoPlayer(videoId: string) {
    if (this.youtubePlayer) {
        // Forzar la actualización del componente YouTubePlayer
        this.youtubePlayer.videoId = videoId; // Actualiza el videoId directamente
        this.youtubePlayer.ngOnChanges({}); // Forzar a Angular a detectar los cambios
        localStorage.setItem('videoId', videoId);
    }
  }

  
  ngOnDestroy(): void {
    // Cancela todas las suscripciones cuando el componente se destruye para prevenir fugas de memoria
    // Asegurarse de desconectar el socket al salir
    this.socketService.disconnect();
    console.log('Socket desconectado al salir de la sala');
  }
}
