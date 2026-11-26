/* All this does right now is tests to see if the sound driver actually works */

import { GdConsts } from './gd-consts.ts';
import { Sound } from './includes/sound.ts';
import {
	SoundDriver,
	type NoiseProfile,
} from './sound-work-inc/sound-driver.js';

let tandy: SoundDriver;
const speaker = new SoundDriver({ device: 'speaker' });
let noiseProfile: NoiseProfile;
let chipMix: 'unipolar' | 'bipolar';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<h2>Setup</h2>
<h3>Options</h3>
<h4>Noise Profile</h4>
<label><input type="radio" id="ncrRadio" name="noise" value="ncr8496" checked /> NCR8496</label>
<label><input type="radio" id="tiRadio" name="noise" value="ti15" /> TI15</label>
<label><input type="radio" id="pssjRadio" name="noise" value="pssj3" /> PSSJ3</label>
<h4>Chip Mix</h4>
<label><input type="radio" id="uniRadio" name="mix" value="unipolar" checked /> Unipolar</label>
<label><input type="radio" id="biRadio" name="mix" value="bipolar" /> Bipolar</label>
<h3>Install</h3>
<button id="installTandyBtn">Install Tandy</button>
<button id="installSpkrBtn">Install Speaker</button>
<h2>Play</h2>
<h3>Tandy</h3>
<button id="impactTandyBtn">Impact</button>
<button id="stepTandyBtn">Step</button>
<button id="missTandyBtn">Miss</button>
<button id="downedTandyBtn">Downed</button>
<button id="damageTandyBtn">Damage</button>
<h3>Speaker</h3>
<button id="impactSpkrBtn">Impact</button>
<button id="stepSpkrBtn">Step</button>
<button id="missSpkrBtn">Miss</button>
<button id="downedSpkrBtn">Downed</button>
<button id="damageSpkrBtn">Damage</button>
<h3>Both</h3>
<button id="impactBothBtn">Impact</button>
<button id="stepBothBtn">Step</button>
<button id="missBothBtn">Miss</button>
<button id="downedBothBtn">Downed</button>
<button id="damageBothBtn">Damage</button>
`;

document.querySelector<HTMLInputElement>('#ncrRadio')!.oninput = () => {
	noiseProfile = 'ncr8496';
};

document.querySelector<HTMLInputElement>('#tiRadio')!.oninput = () => {
	noiseProfile = 'ti15';
};

document.querySelector<HTMLInputElement>('#pssjRadio')!.oninput = () => {
	noiseProfile = 'pssj3';
};

document.querySelector<HTMLInputElement>('#uniRadio')!.oninput = () => {
	chipMix = 'unipolar';
};

document.querySelector<HTMLInputElement>('#biRadio')!.oninput = () => {
	chipMix = 'bipolar';
};

document.querySelector<HTMLButtonElement>('#installTandyBtn')!.onclick =
	async () => {
		tandy = new SoundDriver({ device: 'tandy', noiseProfile, chipMix });
		await tandy.installSoundTimer();
	};

document.querySelector<HTMLButtonElement>('#installSpkrBtn')!.onclick =
	async () => {
		await speaker.installSoundTimer();
	};

const impact = GdConsts.soundIds.combat[Sound.IMPACT] - 1;

document.querySelector<HTMLButtonElement>('#impactTandyBtn')!.onclick = () => {
	tandy.programTandyVoices(impact);
};

document.querySelector<HTMLButtonElement>('#impactSpkrBtn')!.onclick = () => {
	speaker.programSpeakerVoices(impact);
};

document.querySelector<HTMLButtonElement>('#impactBothBtn')!.onclick = () => {
	tandy.programTandyVoices(impact);
	speaker.programSpeakerVoices(impact);
};

const step = GdConsts.soundIds.combat[Sound.STEP] - 1;

document.querySelector<HTMLButtonElement>('#stepTandyBtn')!.onclick = () => {
	tandy.programTandyVoices(step);
};

document.querySelector<HTMLButtonElement>('#stepSpkrBtn')!.onclick = () => {
	speaker.programSpeakerVoices(step);
};

document.querySelector<HTMLButtonElement>('#stepBothBtn')!.onclick = () => {
	tandy.programTandyVoices(step);
	speaker.programSpeakerVoices(step);
};

const miss = GdConsts.soundIds.combat[5] - 1;

document.querySelector<HTMLButtonElement>('#missTandyBtn')!.onclick = () => {
	tandy.programTandyVoices(miss);
};

document.querySelector<HTMLButtonElement>('#missSpkrBtn')!.onclick = () => {
	speaker.programSpeakerVoices(miss);
};

document.querySelector<HTMLButtonElement>('#missBothBtn')!.onclick = () => {
	tandy.programTandyVoices(miss);
	speaker.programSpeakerVoices(miss);
};

const downed = GdConsts.soundIds.combat[1] - 1;

document.querySelector<HTMLButtonElement>('#downedTandyBtn')!.onclick = () => {
	tandy.programTandyVoices(downed);
};

document.querySelector<HTMLButtonElement>('#downedSpkrBtn')!.onclick = () => {
	speaker.programSpeakerVoices(downed);
};

document.querySelector<HTMLButtonElement>('#downedBothBtn')!.onclick = () => {
	tandy.programTandyVoices(downed);
	speaker.programSpeakerVoices(downed);
};

const damage = GdConsts.soundIds.damage - 1;

document.querySelector<HTMLButtonElement>('#damageTandyBtn')!.onclick = () => {
	tandy.programTandyVoices(damage);
};

document.querySelector<HTMLButtonElement>('#damageSpkrBtn')!.onclick = () => {
	speaker.programSpeakerVoices(damage);
};

document.querySelector<HTMLButtonElement>('#damageBothBtn')!.onclick = () => {
	tandy.programTandyVoices(damage);
	speaker.programSpeakerVoices(damage);
};
