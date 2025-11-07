/**
 * Audio Service
 * Handles WebSocket audio streaming and playback for live calls
 * Supports WAV and PCM16LE audio formats from Bland AI
 */

class AudioService {
  constructor() {
    this.socket = null;
    this.audioContext = null;
    this.playing = false;
    this.audioQueue = [];
    this.statusCallback = null;
    this.errorCallback = null;
    this.inputSampleRate = 16000; // Bland AI default
  }

  /**
   * Start audio playback from WebSocket URL
   * @param {string} wsUrl - WebSocket URL from Bland AI
   * @param {Function} onStatusChange - Callback for status updates
   * @param {Function} onError - Callback for errors
   */
  async startAudioPlayback(wsUrl, onStatusChange, onError) {
    this.statusCallback = onStatusChange;
    this.errorCallback = onError;

    try {
      this.updateStatus('Connecting to websocket...');

      // Create AudioContext (requires user gesture, should be called in event handler)
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      console.log('[AudioService] audioContext sampleRate:', this.audioContext.sampleRate);
      this.updateStatus('Creating WebSocket connection...');

      // Create WebSocket connection
      this.socket = new WebSocket(wsUrl);
      this.socket.binaryType = 'arraybuffer';

      this.socket.onopen = () => {
        console.log('[AudioService] WebSocket opened');
        this.updateStatus('Connected - receiving audio');
      };

      this.socket.onerror = (event) => {
        console.error('[AudioService] WebSocket error:', event);
        this.updateStatus('WebSocket error');
        if (this.errorCallback) {
          this.errorCallback('WebSocket connection error');
        }
      };

      this.socket.onclose = (event) => {
        console.log('[AudioService] WebSocket closed:', event.code);
        this.updateStatus(`Connection closed (code ${event.code || 'unknown'})`);
        this.playing = false;
        // Clean up when connection closes
        this.audioQueue = [];
      };

      this.socket.onmessage = async (event) => {
        try {
          await this.handleAudioMessage(event.data);
        } catch (error) {
          console.error('[AudioService] Error handling audio message:', error);
          if (this.errorCallback) {
            this.errorCallback('Error processing audio data');
          }
        }
      };
    } catch (error) {
      console.error('[AudioService] Error starting playback:', error);
      this.updateStatus('Failed to start playback');
      if (this.errorCallback) {
        this.errorCallback(error.message);
      }
      throw error;
    }
  }

  /**
   * Handle incoming audio message from WebSocket
   * @param {ArrayBuffer|string} data - Audio data or control message
   */
  async handleAudioMessage(data) {
    // Handle text messages (control messages)
    if (typeof data === 'string') {
      console.log('[AudioService] Received text message:', data.slice(0, 200));
      try {
        const json = JSON.parse(data);
        if (json?.type) {
          console.log('[AudioService] Control message type:', json.type);
        }
      } catch (e) {
        // Not JSON, ignore
      }
      return;
    }

    // Handle binary audio data
    const ab = data;
    console.debug('[AudioService] Received binary data, length:', ab.byteLength);

    // Detect format: check for WAV (RIFF) header
    const dv = new DataView(ab);
    const header4 = String.fromCharCode(
      dv.getUint8(0),
      dv.getUint8(1),
      dv.getUint8(2),
      dv.getUint8(3)
    );

    if (header4 === 'RIFF') {
      console.log('[AudioService] Detected WAV format');
      try {
        const audioBuf = await this.decodeWav(ab);
        this.enqueueAudioBuffer(audioBuf);
      } catch (error) {
        console.error('[AudioService] Error decoding WAV:', error);
        throw error;
      }
    } else {
      // Assume PCM16LE format
      console.log('[AudioService] Assuming PCM16LE format');
      try {
        const float32 = this.decodePCM16LE(ab);
        const finalFloat32 = await this.resampleIfNeeded(float32);
        this.pushFloat32ToQueue(finalFloat32);
      } catch (error) {
        console.error('[AudioService] Error decoding PCM16LE:', error);
        const bytes = new Uint8Array(ab.slice(0, 32));
        const hexDump = Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(' ');
        console.error('[AudioService] First 32 bytes:', hexDump);
        throw error;
      }
    }
  }

  /**
   * Decode WAV audio data
   * @param {ArrayBuffer} arrayBuffer - WAV data
   * @returns {Promise<AudioBuffer>} - Decoded audio buffer
   */
  decodeWav(arrayBuffer) {
    return new Promise((resolve, reject) => {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      this.audioContext.decodeAudioData(arrayBuffer.slice(0), (buf) => resolve(buf), (e) =>
        reject(e)
      );
    });
  }

  /**
   * Decode PCM16LE audio data
   * @param {ArrayBuffer} arrayBuffer - PCM16LE data
   * @returns {Float32Array} - Float32 samples
   */
  decodePCM16LE(arrayBuffer) {
    const dv = new DataView(arrayBuffer);
    const len = arrayBuffer.byteLength / 2;
    const int16 = new Int16Array(len);

    for (let i = 0; i < len; i++) {
      int16[i] = dv.getInt16(i * 2, true); // little endian
    }

    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      out[i] = int16[i] / 32768;
    }

    return out;
  }

  /**
   * Resample audio if needed
   * @param {Float32Array} float32Samples - Input samples
   * @param {number} inputSampleRate - Input sample rate (default 16000)
   * @returns {Promise<Float32Array>} - Resampled audio
   */
  async resampleIfNeeded(float32Samples, inputSampleRate = this.inputSampleRate) {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const targetRate = this.audioContext.sampleRate;

    if (inputSampleRate === targetRate) {
      return float32Samples;
    }

    // Create buffer with input sample rate
    const channels = 1;
    const buffer = this.audioContext.createBuffer(channels, float32Samples.length, inputSampleRate);
    buffer.copyToChannel(float32Samples, 0, 0);

    // Use OfflineAudioContext to resample
    const targetLength = Math.round((float32Samples.length * targetRate) / inputSampleRate);
    const offline = new OfflineAudioContext(channels, targetLength, targetRate);
    const src = offline.createBufferSource();
    src.buffer = buffer;
    src.connect(offline.destination);
    src.start(0);

    const rendered = await offline.startRendering();
    const renderedData = rendered.getChannelData(0);

    console.debug(
      `[AudioService] Resampled: ${inputSampleRate} -> ${targetRate}, inLen=${float32Samples.length}, outLen=${renderedData.length}`
    );

    return new Float32Array(renderedData);
  }

  /**
   * Push float32 audio to queue for playback
   * @param {Float32Array} f32 - Audio data
   */
  pushFloat32ToQueue(f32) {
    this.audioQueue.push(f32);
    if (!this.playing) {
      this.playing = true;
      this.playFromQueue();
    }
  }

  /**
   * Enqueue and process AudioBuffer
   * @param {AudioBuffer} audioBuffer - Audio buffer
   */
  enqueueAudioBuffer(audioBuffer) {
    const sampleRate = this.audioContext.sampleRate;

    if (audioBuffer.sampleRate === sampleRate) {
      // Same sample rate, just copy
      this.pushFloat32ToQueue(audioBuffer.getChannelData(0).slice());
    } else {
      // Need to resample
      (async () => {
        try {
          const channels = audioBuffer.numberOfChannels;
          const source = audioBuffer;
          const offline = new OfflineAudioContext(
            1,
            Math.round((source.length * sampleRate) / source.sampleRate),
            sampleRate
          );
          const srcNode = offline.createBufferSource();

          // Mix to mono
          const mono = offline.createBuffer(1, source.length, source.sampleRate);
          const tmp = new Float32Array(source.length);

          for (let ch = 0; ch < channels; ch++) {
            const d = source.getChannelData(ch);
            for (let i = 0; i < tmp.length; i++) {
              tmp[i] = (i === 0 ? 0 : tmp[i]) + d[i];
            }
          }

          // Average channels
          for (let i = 0; i < tmp.length; i++) {
            tmp[i] = tmp[i] / channels;
          }

          mono.copyToChannel(tmp, 0, 0);
          srcNode.buffer = mono;
          srcNode.connect(offline.destination);
          srcNode.start(0);

          const rendered = await offline.startRendering();
          this.pushFloat32ToQueue(rendered.getChannelData(0).slice());
        } catch (error) {
          console.error('[AudioService] Error resampling AudioBuffer:', error);
        }
      })();
    }
  }

  /**
   * Play audio from queue
   */
  playFromQueue() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (this.audioQueue.length === 0) {
      this.playing = false;
      return;
    }

    const chunk = this.audioQueue.shift();

    try {
      const buffer = this.audioContext.createBuffer(1, chunk.length, this.audioContext.sampleRate);
      buffer.copyToChannel(chunk, 0);

      const src = this.audioContext.createBufferSource();
      src.buffer = buffer;
      src.connect(this.audioContext.destination);
      src.start();

      src.onended = () => {
        // Schedule next chunk
        setTimeout(() => this.playFromQueue(), 0);
      };
    } catch (error) {
      console.error('[AudioService] Error playing audio:', error);
      this.playing = false;
    }
  }

  /**
   * Stop audio playback and close WebSocket
   */
  stopAudioPlayback() {
    this.updateStatus('Stopping...');

    if (this.socket) {
      try {
        this.socket.close();
      } catch (error) {
        console.warn('[AudioService] Error closing socket:', error);
      }
      this.socket = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (error) {
        console.warn('[AudioService] Error closing audio context:', error);
      }
      this.audioContext = null;
    }

    this.audioQueue = [];
    this.playing = false;

    this.updateStatus('Stopped');
  }

  /**
   * Update status via callback
   * @param {string} status - Status message
   */
  updateStatus(status) {
    console.log('[AudioService] Status:', status);
    if (this.statusCallback) {
      this.statusCallback(status);
    }
  }

  /**
   * Check if currently playing
   * @returns {boolean}
   */
  isPlaying() {
    return this.playing || (this.socket && this.socket.readyState === WebSocket.OPEN);
  }
}

export default new AudioService();
