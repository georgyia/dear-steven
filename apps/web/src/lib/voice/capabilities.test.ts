import { describe, expect, it } from 'vitest';
import {
  chooseVoiceInput,
  chooseVoiceOutput,
  extensionFor,
  pickRecorderMime,
  type VoiceEnvironment,
} from './capabilities';

const chrome: VoiceEnvironment = {
  secureContext: true,
  hasGetUserMedia: true,
  hasSpeechRecognition: true,
  hasMediaRecorder: true,
  hasSpeechSynthesis: true,
  serverVoice: true,
  browserRecognitionFailed: false,
};

describe('chooseVoiceInput', () => {
  it('prefers the browser’s own recognition', () => {
    expect(chooseVoiceInput(chrome)).toBe('browser');
  });

  it('uses server transcription on Firefox (no Web Speech)', () => {
    expect(chooseVoiceInput({ ...chrome, hasSpeechRecognition: false })).toBe('server');
  });

  it('switches to the server after Web Speech has failed, when it can', () => {
    expect(chooseVoiceInput({ ...chrome, browserRecognitionFailed: true })).toBe('server');
    expect(
      chooseVoiceInput({ ...chrome, browserRecognitionFailed: true, serverVoice: false }),
    ).toBe('browser');
  });

  it('offers no voice without a secure context, a microphone API, or any recogniser', () => {
    expect(chooseVoiceInput({ ...chrome, secureContext: false })).toBe('none');
    expect(chooseVoiceInput({ ...chrome, hasGetUserMedia: false })).toBe('none');
    expect(chooseVoiceInput({ ...chrome, hasSpeechRecognition: false, serverVoice: false })).toBe(
      'none',
    );
  });
});

describe('chooseVoiceOutput', () => {
  it('uses the server voice when configured, else the browser’s', () => {
    expect(chooseVoiceOutput(chrome)).toBe('server');
    expect(chooseVoiceOutput({ ...chrome, serverVoice: false })).toBe('browser');
    expect(chooseVoiceOutput({ serverVoice: false, hasSpeechSynthesis: false })).toBe('none');
  });
});

describe('pickRecorderMime', () => {
  it('picks webm/opus where available and mp4 on Safari', () => {
    expect(pickRecorderMime((m) => m.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
    expect(pickRecorderMime((m) => m === 'audio/mp4')).toBe('audio/mp4');
    expect(pickRecorderMime(() => false)).toBe('');
    expect(extensionFor('audio/mp4')).toBe('m4a');
    expect(extensionFor('audio/webm;codecs=opus')).toBe('webm');
  });
});
