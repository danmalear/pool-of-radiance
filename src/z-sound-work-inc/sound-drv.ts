/* PC-speaker and Tandy SN76489 sound controls and clock delays. SoundCommand selects tunes, output gating and optional
  per-command cleanup. SoundSuspend saves the mode and silences the devices; SoundSetAutoStop controls the timer
  driver's lifetime. SOUNDDRV.OBJ owns the timer sequencer, streams and device voice state; GDVars holds the current and
  saved modes and the auto-stop setting. */
/* {$F+} */
import {Sound} from '../includes/sound.js';
import {Dos} from '../includes/dos.js';
import {GdConsts} from '../gd-consts.js';
import {gdVars} from '../gd-vars.js';
import { InstallSoundTimer as installBase, UninstallSoundTimer as uninstallBase, ProgramSpeakerVoices as programSpkr, ProgramTandyVoices as programTandy, SetSoundOutputEnabled as setOutput } from './sound-drv-asm.js'

export namespace SoundDrv {

/* Provides the time base for SoundDelay by reading the DOS clock.
  @returns(Clock time in centiseconds. Note: minute times 6000 is computed in number arithmetic and wraps.) */
export type SoundTime = () => number;

/* Paces sound cleanup without relying on the timer interrupt, which the sound driver may have hooked. Busy-waits
   against SoundTime; ends early if a clock sample precedes the starting value, so a clock discontinuity cannot prolong
   the wait.
   @param(centiseconds Number of centiseconds to wait.) */
export type SoundDelay = (cb: () => void, centiseconds: number) => void;

/* Single entry point for sound: mutes or restores output, silences the devices, or starts a tune on whichever device
   is configured. Does nothing when sound is disabled. With auto-stop on, hooks the timer driver first, then waits
   10 centiseconds before silencing both devices and unhooking it.
   @param(cmd 0 silences both devices and disables output, 1 enables output, 255 silences both devices; other values
     select tune cmd minus one for the active device.) */
export type SoundCommand = (cmd: number) => void;

/* Remembers the configured mode and, unless sound is disabled, hooks the timer driver, silences both devices and
   unhooks it again so the game can leave sound idle. */
export type SoundSuspend = () => void;

/* Chooses between a resident timer driver with persistent playback and per-command cleanup that unhooks the driver
   after each sound.
   @param(autoStop Zero installs the timer; nonzero enables fixed-delay cleanup, and a zero-to-nonzero change
     uninstalls it. When sound is disabled the setting is left unchanged.) */
export type SoundSetAutoStop = (autoStop: number) => void;

  /* SoundCommand selector that turns sound output off. */
 export const CMD_DISABLE = 0;
  /* SoundCommand selector that turns sound output back on. */
 export const CMD_ENABLE = 1;
  /* SoundCommand selector that stops playback and silences both devices. */
 export const CMD_STOP = 255;
  /* Tune id that leaves a device's voices silent. */
 export const SILENT_TUNE = 0;
  /* Value passed to SetSoundOutputEnabled to mute output. */
 export const OUTPUT_DISABLED = 0;
  /* Value passed to SetSoundOutputEnabled to allow output. */
 export const OUTPUT_ENABLED = 1;

/* Hooks the timer interrupt so the sequencer runs in the background. */
export const InstallSoundTimer = installBase;

/* Restores the original timer interrupt and silences both devices. */
export const UninstallSoundTimer = uninstallBase;

/* Loads a tune into the PC-speaker voices.
  @param(tuneId Tune to play; SILENT_TUNE silences the voices.) */
export const ProgramSpeakerVoices = programSpkr;

/* Loads a tune into the Tandy SN76489 voices.
  @param(tuneId Tune to play; SILENT_TUNE silences the voices.) */
export const ProgramTandyVoices = programTandy;

/* Gates the sound output without disturbing the loaded tune.
  @param(enabledValue OUTPUT_ENABLED or OUTPUT_DISABLED; only the low byte is used.) */
export const SetSoundOutputEnabled = setOutput;

function SoundTime(): number {
	const time = new Date();

  return time.getHours() * 360000 + time.getMinutes() * 6000 + time.getSeconds() * 100 + time.getMilliseconds() / 10;
 }

function SoundDelay(cb: () => void, centiseconds: number)
{
	setTimeout(cb, centiseconds * 10)
}

function SoundCommand(cmd: number)
{
  if (gdVars.soundMode = Sound.OFF) { return;}
  if (gdVars.soundAutoStop ?? 0 > 0) { SoundDrv.InstallSoundTimer();}
  case cmd of
    SoundDrv.CMD_DISABLE: begin
      SoundDrv.ProgramTandyVoices(SoundDrv.SILENT_TUNE);
      SoundDrv.ProgramSpeakerVoices(SoundDrv.SILENT_TUNE);
      SoundDrv.SetSoundOutputEnabled(SoundDrv.OUTPUT_DISABLED);
    end;
    SoundDrv.CMD_ENABLE: SoundDrv.SetSoundOutputEnabled(SoundDrv.OUTPUT_ENABLED);
    SoundDrv.CMD_STOP: begin
      SoundDrv.ProgramTandyVoices(SoundDrv.SILENT_TUNE);
      SoundDrv.ProgramSpeakerVoices(SoundDrv.SILENT_TUNE);
    end;
  else
    case GDVars.soundMode of
      C_Sound.SPEAKER: SoundDrv.ProgramSpeakerVoices(cmd - 1);
      C_Sound.TANDY: SoundDrv.ProgramTandyVoices(cmd - 1);
    end;
  end;
  if GDVars.soundAutoStop > 0 then begin
    SoundDrv.SoundDelay(() => {
			SoundDrv.ProgramTandyVoices(SoundDrv.SILENT_TUNE);
    SoundDrv.ProgramSpeakerVoices(SoundDrv.SILENT_TUNE);
    SoundDrv.UninstallSoundTimer;
		}
		, 10);
    
  end;
	}

procedure SoundSuspend;
begin
  GDVars.soundSaved := GDVars.soundMode;
  if GDVars.soundMode = C_Sound.OFF then Exit;
  SoundDrv.InstallSoundTimer;
  SoundDrv.ProgramSpeakerVoices(SoundDrv.SILENT_TUNE);
  SoundDrv.ProgramTandyVoices(SoundDrv.SILENT_TUNE);
  SoundDrv.UninstallSoundTimer;
end;

procedure SoundSetAutoStop(autoStop: number);
begin
  if GDVars.soundMode = C_Sound.OFF then Exit;
  if autoStop > 0 then begin
    if GDVars.soundAutoStop = 0 then SoundDrv.UninstallSoundTimer;
  end else
    SoundDrv.InstallSoundTimer;
  GDVars.soundAutoStop := autoStop;
end;

begin
end.

}