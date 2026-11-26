// PC-speaker and Tandy SN76489 timer sequencer, linked into SoundDrv by SOUNDDRV.OBJ.
// Owns voice blocks, tune streams, envelopes and modulation tables in CODE.
// Pascal far entries install/remove INT 8, load tunes and control the output gate.
// Four voices per device are stepped// the speaker uses the first active voice.
// The displaced BIOS handler runs every thirteenth tick.

// CODE    SEGMENT BYTE PUBLIC 'CODE'
//         ASSUME  CS:CODE, DS:CODE
//         PUBLIC  InstallSoundTimer, UninstallSoundTimer
//         PUBLIC  ProgramSpeakerVoices, ProgramTandyVoices, SetSoundOutputEnabled

// ---------------------------------------------------------------------------
// Voice state. SSET writes fields by offset// voice_step advances them
// on each timer interrupt.
// ---------------------------------------------------------------------------
interface Voice {
duration      :      number;       // ticks until the sequencer next steps this voice
stream        :      number | null;       // stream pointer// 0 = the voice is idle
period        :      number;       // pitch accumulator
periodAdd     :      number;       // added to vfPeriod each tick -- a pitch slide
outPeriod     :      number;       // vfPeriod plus the LFO// this is what the chip gets
level         :      number;       // output level
levelAdd      :      number;       // added to vfLevel each tick
tempo         :      number;       // low byte scales duration// 0 or 1 leaves it unchanged
releaseLead   :      number;       // release lead// unused
transpose     :      number;       // added to a note's pitch before the octave reduction
gateLen       :      number;       // when it expires the envelope restarts at its 5th pair
envBase       :      number;       // base of this voice's (value;ticks) envelope list
envPos        :      number;       // byte offset into that list
envWait       :      number;       // ticks left in the current envelope segment
lfoTable      :      number;       // base pointer into the LFO samples
lfoPhase      :      number;       // LFO phase accumulator
lfoRate       :      number;       // added to vfLfoPhase each tick
lfoDepth      :      number;       // signed multiplier on the waveform sample
lfoWrap       :      number;       // vfLfoPhase wraps here
loopCounterA  :      number;       // SLOOP counter
loopCounterB  :      number;       // SLOOP counter for a loop nested inside the first
}

const newVoice: () => Voice = () => ({
duration      :      0,       // ticks until the sequencer next steps this voice
stream        :      null,       // stream pointer// 0 = the voice is idle
period        :      0,       // pitch accumulator
periodAdd     :      0,       // added to vfPeriod each tick -- a pitch slide
outPeriod     :      0,       // vfPeriod plus the LFO// this is what the chip gets
level         :      0,       // output level
levelAdd      :      0,       // added to vfLevel each tick
tempo         :      0,       // low byte scales duration// 0 or 1 leaves it unchanged
releaseLead   :      0,       // release lead// unused
transpose     :      0,       // added to a note's pitch before the octave reduction
gateLen       :      0,       // when it expires the envelope restarts at its 5th pair
envBase       :      0,       // base of this voice's (value,ticks) envelope list
envPos        :      0,       // byte offset into that list
envWait       :      0,       // ticks left in the current envelope segment
lfoTable      :      0,       // base pointer into the LFO samples
lfoPhase      :      0,       // LFO phase accumulator
lfoRate       :      0,       // added to vfLfoPhase each tick
lfoDepth      :      0,       // signed multiplier on the waveform sample
lfoWrap       :      0,       // vfLfoPhase wraps here
loopCounterA  :      0,       // SLOOP counter
loopCounterB  :      0,       // SLOOP counter for a loop nested inside the first
})

// ---------------------------------------------------------------------------
// Note tables: one octave per device. seq_note selects a semitone,
// then shifts its period right by the octave number.
// ---------------------------------------------------------------------------
// PC-speaker divisors for PIT channel 2, starting at C1.
// Nominal frequencies below assume a 1193182 Hz PIT input.
const spkC    = 0x8E84    // C1    32.704 Hz
const spkCS   = 0x8684    // C#1   34.649 Hz
const spkD    = 0x7EF7    // D1    36.710 Hz
const spkDS   = 0x77D7    // D#1   38.892 Hz
const spkE    = 0x714F    // E1    41.134 Hz// 2.9 cents flat
const spkF    = 0x6AC4    // F1    43.655 Hz
const spkFS   = 0x64C6    // F#1   46.251 Hz
const spkG    = 0x5F1E    // G1    49.001 Hz
const spkGS   = 0x59C7    // G#1   51.916 Hz
const spkA    = 0x54BD    // A1    55.003 Hz
const spkAS   = 0x4FFC    // A#1   58.272 Hz
const spkB    = 0x4B7E    // B1    61.740 Hz

// Tandy SN76489 periods with nominal note names starting at A2.
// Each 10-bit period is shifted left by six// tick_tandy shifts it back before output.
const snA2    = 0x0FFC0   // A2  n=1023
const snAS2   = 0x0F140   // A#2 n=965
const snB2    = 0x0E3C0   // B2  n=911
const snC3    = 0x0D700   // C3  n=860
const snCS3   = 0x0CB40   // C#3 n=813
const snD3    = 0x0BF80   // D3  n=766
const snDS3   = 0x0B4C0   // D#3 n=723
const snE3    = 0x0AA80   // E3  n=682
const snF3    = 0x0A100   // F3  n=644
const snFS3   = 0x9800    // F#3 n=608
const snG3    = 0x8F80    // G3  n=574
const snGS3   = 0x8740    // G#3 n=541

// ---------------------------------------------------------------------------
// Driver state.  The ISR and the voice writers reach all of it with DS = CODE.
// ---------------------------------------------------------------------------
let divCount        =      13              // ticks left before the next BIOS INT 8 chain
let blockSize       =      SIZE Voice      // seq_note multiplies a voice index by it

let seqVoice        =      0               // the voice block seq_proc is running
let seqRet          =      0               // the stream pointer SCALL saved -- one level only
let voiceTune       =      [0,0,0,0]         // tune id per voice// seq_end clears a voice's entry
                                        //   when that voice runs out of stream

// Duration table: 3:4 pairs double at each step. Notes carry explicit durations,
// so nothing reads this table.
const noteLen        =      [0x000,0x000,0x000,0x002,0x000,0x003,0x004,0x000,0x006,0x008,0x000,0x00C,0x010,0x000,0x018,0x020,
                     0x000,0x030,0x040]

// Sequencer command dispatch for stream bytes 0FAh through 0FFh, in that order.
const cmdTable        =      [seq_c_reset, seq_c_ret, seq_c_call,
                      seq_c_clear, seq_c_loop, seq_c_set]

// Four PC-speaker voices, cleared when a tune starts.
const spkrBlocks      = [newVoice(),
                newVoice(),
                newVoice(),
                newVoice()]

// Four unused voice blocks reserved after the active voices.
const spkrSpare    =   [newVoice(),
                newVoice(),
                newVoice(),
                newVoice()]

const spkrFreq        =      [spkC, spkCS, spkD, spkDS, spkE, spkF,
                            spkFS, spkG, spkGS, spkA, spkAS, spkB]

const tandyBlocks =     [newVoice(),
                newVoice(),
                newVoice(),
     newVoice()]
const tandyVoice3 = tandyBlocks[3]              // Fourth Tandy voice.

// Four unused Tandy voice blocks.
const tandySpare    =  [newVoice(),
                 newVoice(),
                 newVoice(),
                 newVoice()]

const tandyFreq       =      [snA2, snAS2, snB2, snC3, snCS3, snD3,
                      snDS3, snE3, snF3, snFS3, snG3, snGS3]

// ---------------------------------------------------------------------------
// SONG TABLES.  One row per tune id, four stream pointers per row -- voice 0 to
// voice 3. Both voice programmers index by id * 8// a zero pointer preserves that voice.
// ---------------------------------------------------------------------------
// Speaker rows use voice 0// tune 20 also configures other blocks from its setup stream.
const songTableA     =      [[silentA,     silentA,     silentA,     silentA],      // tune  0
                      [tuneA01_v0,  silentA,     silentA,     silentA],      // tune  1
                      [tuneA02_v0,  silentA,     silentA,     silentA],      // tune  2
                      [tuneA03_v0,  silentA,     silentA,     silentA],      // tune  3
                      [tuneA04_v0,  silentA,     silentA,     silentA],      // tune  4
                      [tuneA05_v0,  silentA,     silentA,     silentA],      // tune  5
                      [tuneA06_v0,  silentA,     silentA,     silentA],      // tune  6
                      [tuneA07_v0,  silentA,     silentA,     silentA],      // tune  7
                      [tuneA08_v0,  silentA,     silentA,     silentA],      // tune  8
                      [tuneA09_v0,  silentA,     silentA,     silentA],      // tune  9
                      [tuneA10_v0,  silentA,     silentA,     silentA],      // tune 10
                      [tuneA11_v0,  silentA,     silentA,     silentA],      // tune 11
                      [tuneA12_v0,  silentA,     silentA,     silentA],      // tune 12
                      [tuneA13_v0,  silentA,     silentA,     silentA],      // tune 13
                      [tuneA14_v0,  silentA,     silentA,     silentA],      // tune 14
                      [tuneA15_v0,  silentA,     silentA,     silentA],      // tune 15
                      [tuneA16_v0,  silentA,     silentA,     silentA],      // tune 16
                      [tuneA17_v0,  silentA,     silentA,     silentA],      // tune 17
                      [tuneA18_v0,  silentA,     silentA,     silentA],      // tune 18
                      [tuneA19_v0,  silentA,     silentA,     silentA],      // tune 19
                      [tuneA20_v0,  0,           0,           0      ]]      // tune 20

// Tandy rows include tone and noise streams.
const songTableB     =       [[silentB,     silentB,     silentB,     silentB    ],  // tune  0
                      [tuneB01_v0,  tuneB01_v1,  tuneB01_v2,  silentB    ],  // tune  1
                      [silentB,     silentB,     silentB,     tuneB02_v3 ],  // tune  2
                      [tuneB03_v0,  tuneB03_v1,  tuneB03_v2,  silentB    ],  // tune  3
                      [tuneB04_v0,  silentB,     tuneB04_v2,  tuneB04_v3 ],  // tune  4
                      [tuneB05_v0,  silentB,     silentB,     silentB    ],  // tune  5
                      [silentB,     silentB,     tuneB06_v2,  tuneB06_v3 ],  // tune  6
                      [tuneB07_v0,  tuneB07_v1,  silentB,     silentB    ],  // tune  7
                      [silentB,     silentB,     silentB,     tuneB08_v3 ],  // tune  8
                      [silentB,     silentB,     silentB,     tuneB09_v3 ],  // tune  9
                      [silentB,     silentB,     tuneB10_v2,  tuneB10_v3 ],  // tune 10
                      [tuneB11_v0,  tuneB11_v1,  tuneB11_v2,  silentB    ],  // tune 11
                      [silentB,     silentB,     tuneB12_v2,  tuneB12_v3 ],  // tune 12
                      [tuneB13_v0,  silentB,     tuneB13_v2,  tuneB13_v3 ],  // tune 13
                      [silentB,     silentB,     tuneB14_v2,  tuneB14_v3 ],  // tune 14
                      [silentB,     silentB,     tuneB15_v2,  tuneB15_v3 ],  // tune 15
                      [silentB,     silentB,     tuneB16_v2,  tuneB16_v3 ],  // tune 16
                      [silentB,     silentB,     tuneB17_v2,  silentB    ],  // tune 17
                      [tuneB18_v0,  silentB,     tuneB18_v2,  tuneB18_v3 ],  // tune 18
                      [tuneB19_v0,  silentB,     silentB,     silentB    ],  // tune 19
                      [tuneB20_v0,  silentB,     silentB,     silentB    ]]  // tune 20

// ---------------------------------------------------------------------------
// LFO WAVEFORMS.  A voice picks one by pointing vfLfoTable at it// voice_step reads
// a byte, scales it by vfLfoDepth and adds the result to the pitch going out.
// ---------------------------------------------------------------------------
// One sine cycle: 256 signed samples, amplitude0x 7E,
const lfoSine      =        [0x000,0x003,0x006,0x009,0x00C,0x00F,0x012,0x015,0x018,0x01B,0x01E,0x021,0x024,0x027,0x02A,0x02D,
                      0x030,0x033,0x036,0x039,0x03B,0x03E,0x041,0x043,0x046,0x049,0x04B,0x04E,0x050,0x052,0x055,0x057,
                      0x059,0x05B,0x05E,0x060,0x062,0x064,0x066,0x067,0x069,0x06B,0x06C,0x06E,0x070,0x071,0x072,0x074,
                      0x075,0x076,0x077,0x078,0x079,0x07A,0x07B,0x07B,0x07C,0x07D,0x07D,0x07E,0x07E,0x07E,0x07E,0x07E,
                      0x07E,0x07E,0x07E,0x07E,0x07E,0x07E,0x07D,0x07D,0x07C,0x07B,0x07B,0x07A,0x079,0x078,0x077,0x076,
                      0x075,0x074,0x072,0x071,0x070,0x06E,0x06C,0x06B,0x069,0x067,0x066,0x064,0x062,0x060,0x05E,0x05B,
                      0x059,0x057,0x055,0x052,0x050,0x04E,0x04B,0x049,0x046,0x043,0x041,0x03E,0x03B,0x039,0x036,0x033,
                      0x030,0x02D,0x02A,0x027,0x024,0x021,0x01E,0x01B,0x018,0x015,0x012,0x00F,0x00C,0x009,0x006,0x003,
                      0x000,0x0FD,0x0FA,0x0F7,0x0F4,0x0F1,0x0EE,0x0EB,0x0E8,0x0E5,0x0E2,0x0DF,0x0DC,0x0D9,0x0D6,0x0D3,
                      0x0D0,0x0CD,0x0CA,0x0C7,0x0C5,0x0C2,0x0BF,0x0BD,0x0BA,0x0B7,0x0B5,0x0B2,0x0B0,0x0AE,0x0AB,0x0A9,
                      0x0A7,0x0A5,0x0A2,0x0A0,0x09E,0x09C,0x09A,0x099,0x097,0x095,0x094,0x092,0x090,0x08F,0x08E,0x08C,
                      0x08B,0x08A,0x089,0x088,0x087,0x086,0x085,0x085,0x084,0x083,0x083,0x082,0x082,0x082,0x082,0x082,
                      0x082,0x082,0x082,0x082,0x082,0x082,0x083,0x083,0x084,0x085,0x085,0x086,0x087,0x088,0x089,0x08A,
                      0x08B,0x08C,0x08E,0x08F,0x090,0x092,0x094,0x095,0x097,0x099,0x09A,0x09C,0x09E,0x0A0,0x0A2,0x0A5,
                      0x0A7,0x0A9,0x0AB,0x0AE,0x0B0,0x0B2,0x0B5,0x0B7,0x0BA,0x0BD,0x0BF,0x0C2,0x0C5,0x0C7,0x0CA,0x0CD,
                      0x0D0,0x0D3,0x0D6,0x0D9,0x0DC,0x0DF,0x0E2,0x0E5,0x0E8,0x0EB,0x0EE,0x0F1,0x0F4,0x0F7,0x0FA,0x0FD]

// Zero samples, followed by constant samples// the selected wrap can span 0xbot regions.
const lfoZero         =      [0x000,0x000,0x000,0x000,0x000,0x000,0x000,0x000,0x000,0x000,0x000,0x000,0x000,0x000,0x000,0x000]

// Constant samples for a positive pitch offset.
const lfoFlat         =      [0x078,0x078,0x078,0x078,0x078,0x078,0x078,0x078,0x078,0x078,0x078,0x078,0x078,0x078,0x078,0x078]

// Pseudo-random waveform for percussion and sound effects.
const lfoNoise   =     [0x029,0x023,0x0BE,0x084,0x0E1,0x06C,0x0D6,0x0AE,0x052,0x090,0x049,0x0F1,0x0F1,0x0BB,0x0E9,0x0EB,
                      0x0B3,0x0A6,0x0DB,0x03C,0x087,0x00C,0x03E,0x099,0x024,0x05E,0x00D,0x01C,0x006,0x0B7,0x047,0x0DE,
                      0x0B3,0x012,0x04D,0x0C8,0x043,0x0BB,0x08B,0x0A6,0x01F,0x003,0x05A,0x07D,0x009,0x038,0x025,0x01F,
                      0x05D,0x0D4,0x0CB,0x0FC,0x096,0x0F5,0x045,0x03B,0x013,0x00D,0x089,0x00A,0x01C,0x0DB,0x0AE,0x032,
                      0x020,0x09A,0x050,0x0EE,0x040,0x078,0x036,0x0FD,0x012,0x049,0x032,0x0F6,0x09E,0x07D,0x049,0x0DC,
                      0x0AD,0x04F,0x014,0x0F2,0x044,0x040,0x066,0x0D0,0x06B,0x0C4,0x030,0x0B7,0x032,0x03B,0x0A1,0x022,
                      0x0F6,0x022,0x091,0x09D,0x0E1,0x08B,0x01F,0x0DA,0x0B0,0x0CA,0x099,0x002,0x0B9,0x072,0x09D,0x049,
                      0x02C,0x080,0x07E,0x0C5,0x099,0x0D5,0x0E9,0x080,0x0B2,0x0EA,0x0C9,0x0CC,0x053,0x0BF,0x067,0x0D6,
                      0x0BF,0x014,0x0D6,0x07E,0x02D,0x0DC,0x08E,0x066,0x083,0x0EF,0x057,0x049,0x061,0x0FF,0x069,0x08F,
                      0x061,0x0CD,0x0D1,0x01E,0x09D,0x09C,0x016,0x072,0x072,0x0E6,0x01D,0x0F0,0x084,0x04F,0x04A,0x077,
                      0x002,0x0D7,0x0E8,0x039,0x02C,0x053,0x0CB,0x0C9,0x012,0x01E,0x033,0x074,0x09E,0x00C,0x0F4,0x0D5,
                      0x0D4,0x09F,0x0D4,0x0A4,0x059,0x07E,0x035,0x0CF,0x032,0x022,0x0F4,0x0CC,0x0CF,0x0D3,0x090,0x02D,
                      0x048,0x0D3,0x08F,0x075,0x0E6,0x0D9,0x01D,0x02A,0x0E5,0x0C0,0x0F7,0x02B,0x078,0x081,0x087,0x044,
                      0x00E,0x05F,0x050,0x000,0x0D4,0x061,0x08D,0x0BE,0x07B,0x005,0x015,0x007,0x03B,0x033,0x082,0x01F,
                      0x018,0x070,0x092,0x0DA,0x064,0x054,0x0CE,0x0B1,0x085,0x03E,0x069,0x015,0x0F8,0x046,0x06A,0x004,
                      0x096,0x073,0x00E,0x0D9,0x016,0x02F,0x067,0x068,0x0D4,0x0F7,0x04A,0x04A,0x0D0,0x057,0x068,0x076,
                      0x0FA,0x016,0x0BB,0x011,0x0AD,0x0AE,0x024,0x088,0x079,0x0FE,0x052,0x0DB,0x025,0x043,0x0E5,0x03C,
                      0x0F4,0x045,0x0D3,0x0D8,0x028,0x0CE,0x00B,0x0F5,0x0C5,0x060,0x059,0x03D,0x097,0x027,0x08A,0x059,
                      0x076,0x02D,0x0D0,0x0C2,0x0C9,0x0CD,0x068,0x0D4,0x049,0x06A,0x079,0x025,0x008,0x061,0x040,0x014,
                      0x0B1,0x03B,0x06A,0x0A5,0x011,0x028,0x0C1,0x08C,0x0D6,0x0A9,0x00B,0x087,0x097,0x08C,0x02F,0x0F1,
                      0x015,0x01D,0x09A,0x095,0x0C1,0x09B,0x0E1,0x0C0,0x07E,0x0E9,0x0A8,0x09A,0x0A7,0x086,0x0C2,0x0B5,
                      0x054,0x0BF,0x09A,0x0E7,0x0D9,0x023,0x0D1,0x055,0x090,0x038,0x028,0x0D1,0x0D9,0x06C,0x0A1,0x066,
                      0x05E,0x04E,0x0E1,0x030,0x09C,0x0FE,0x0D9,0x071,0x09F,0x0E2,0x0A5,0x0E2,0x00C,0x09B,0x0B4,0x047,
                      0x065,0x038,0x02A,0x046,0x089,0x0A9,0x082,0x079,0x07A,0x076,0x078,0x0C2,0x063,0x0B1,0x026,0x0DF,
                      0x0DA,0x029,0x06D,0x03E,0x062,0x0E0,0x096,0x012,0x034,0x0BF,0x039,0x0A6,0x03F,0x089,0x05E,0x0F1,
                      0x06D,0x00E,0x0E3,0x06C,0x028,0x0A1,0x01E,0x020,0x01D,0x0CB,0x0C2,0x003,0x03F,0x041,0x007,0x084,
                      0x00F,0x014,0x005,0x065,0x01B,0x028,0x061,0x0C9,0x0C5,0x0E7,0x02C,0x08E,0x046,0x036,0x008,0x0DC,
                      0x0F3,0x0A8,0x08D,0x0FE,0x0BE,0x0F2,0x0EB,0x071,0x0FF,0x0A0,0x0D0,0x03B,0x075,0x006,0x08C,0x07E,
                      0x087,0x078,0x073,0x04D,0x0D0,0x0BE,0x082,0x0BE,0x0DB,0x0C2,0x046,0x041,0x02B,0x08C,0x0FA,0x030,
                      0x07F,0x070,0x0F0,0x0A7,0x054,0x086,0x032,0x095,0x0AA,0x05B,0x068,0x013,0x00B,0x0E6,0x0FC,0x0F5,
                      0x0CA,0x0BE,0x07D,0x09F,0x089,0x08A,0x041,0x01B,0x0FD,0x0B8,0x04F,0x068,0x0F6,0x072,0x07B,0x014,
                      0x099,0x0CD,0x0D3,0x00D,0x0F0,0x044,0x03A,0x0B4,0x0A6,0x066,0x053,0x033,0x00B,0x0CB,0x0A1,0x010]

// ---------------------------------------------------------------------------
// Streams and envelopes referenced by the song tables and stream operands.
// ---------------------------------------------------------------------------
// Pitches are scale degrees above the active note table's base -- C for the speaker
// table, A for the Tandy one -- not concert pitches.  seq_note adds the voice's
// vfTranspose, then reduces to an octave and a semitone.
let NT_C    = 0
let NT_CS   = 1
let NT_D    = 2
let NT_DS   = 3
let NT_E    = 4
let NT_F    = 5
let NT_FS   = 6
let NT_G    = 7
let NT_GS   = 8
let NT_A    = 9
let NT_AS   = 10
let NT_B    = 11
let OCT     = 12                      // one octave
let REST    = 0x7F                     // the pitch that sounds nothing

// One macro per sequencer record, each emitting the record the driver decodes.
SRESET  MACRO                       //// 0FAh -- clear the voice this stream is on
        db 0FAh
        ENDM
SRET    MACRO                       //// 0FBh -- back to the stream SCALL came from
        db 0FBh
        ENDM
SCALL   MACRO target                //// 0FCh -- call a stream// seqRet holds one level
        db 0FCh
        dw target
        ENDM
SCLEAR  MACRO vnum                  //// 0FDh -- move this stream onto voice vnum of
        db 0FDh                     ////         the active device and clear it
        dw (vnum) * SIZE VOICE
        ENDM
SLOOP   MACRO field, target         //// 0FEh -- jump if field is zero or decrements to nonzero
        db 0FEh, field
        dw target
        ENDM
SSET    MACRO field, value          //// 0FFh -- store a word into a voice field
        db 0FFh, field
        dw value
        ENDM
SWAIT   MACRO ticks                 //// SSET of vfDuration, which also yields.  Ticks 0
        db 0FFh, 000h               ////   ends the stream: seq_end sees the zero and
        dw ticks                    ////   drops the voice
        ENDM
ENV_SETLEVEL equ 0FFFFh             // in a segment's ticks slot: value is a level to
                                    //   load, and the next segment runs on the same tick
SENV    MACRO value, ticks          //// one envelope segment
        dw value, ticks
        ENDM
SNOTE   MACRO vnum, len, pitch, last, dur   // A note record with explicit duration// len is unused.
        db ((vnum) SHL 5) OR (len), ((last) SHL 7) OR (pitch), dur
        ENDM

tuneA10_v0:
        SSET    vfLevel,         3
        SSET    vfPeriod,        7530h
        SSET    vfLfoTable,      lfoNoise
        SSET    vfLfoWrap,       2000h
        SSET    vfLfoDepth,      2710h
        SSET    vfLfoRate,       10h
        SWAIT   28
        SSET    vfLevel,         0
        SWAIT   12
        SSET    vfLevel,         3
        SSET    vfPeriod,        1004h
        SSET    vfLfoDepth,      898h
        SSET    vfPeriodAdd,     10h
        SWAIT   300
        SSET    vfLevel,         0
        SWAIT   0
tuneA12_v0:
        SSET    vfLevel,         3
        SSET    vfPeriod,        2710h
        SSET    vfLfoTable,      lfoNoise
        SSET    vfLfoWrap,       2000h
        SSET    vfLfoDepth,      2328h
        SSET    vfLfoRate,       10h
        SWAIT   25
        SSET    vfLevel,         0
        SWAIT   2
        SSET    vfLevel,         3
        SSET    vfPeriod,        1388h
        SSET    vfLfoDepth,      0FA0h
        SSET    vfPeriodAdd,     12Ch
        SWAIT   80
        SSET    vfLevel,         0
        SWAIT   0
tuneA13_v0:
        SSET    vfLevel,         3
        SSET    vfPeriod,        0BB8h
        SSET    vfLfoTable,      lfoNoise
        SSET    vfLfoWrap,       2000h
        SSET    vfLfoDepth,      44Ch
        SSET    vfLfoRate,       10h
        SWAIT   2
        SSET    vfLevel,         0
        SWAIT   1
        SSET    vfLevel,         3
        SSET    vfPeriod,        834h
        SSET    vfLfoDepth,      1F4h
        SSET    vfPeriodAdd,     0FF9Ch
        SWAIT   30
        SSET    vfLevel,         0
        SWAIT   0
tuneA18_v0:
        SSET    vfLevel,         3
        SSET    vfPeriod,        1F40h
        SSET    vfLfoTable,      lfoNoise
        SSET    vfLfoWrap,       2000h
        SSET    vfLfoDepth,      44Ch
        SSET    vfLfoRate,       10h
        SWAIT   2
        SSET    vfLevel,         0
        SWAIT   1
        SSET    vfLevel,         3
        SSET    vfPeriod,        17D4h
        SSET    vfLfoDepth,      1F4h
        SSET    vfPeriodAdd,     0FF9Ch
        SWAIT   80
        SSET    vfLevel,         0
        SWAIT   0
tuneA16_v0:
        SSET    vfLevel,         3
        SSET    vfLfoTable,      lfoNoise
        SSET    vfLfoWrap,       2000h
        SSET    vfLfoDepth,      3E8h
        SSET    vfLfoRate,       10h
        SSET    vfPeriodAdd,     0FFCEh
        SSET    vfLoopCounterA,  4
tuneA16_v0_loop:
        SSET    vfPeriod,        2710h
        SWAIT   4
        SSET    vfPeriod,        4E20h
        SSET    vfLevel,         0
        SWAIT   4
        SSET    vfLevel,         3
        SWAIT   4
        SLOOP   vfLoopCounterA, tuneA16_v0_loop
        SSET    vfLevel,         0
        SWAIT   0
tuneA17_v0:
        SSET    vfLevel,         3
        SSET    vfLfoTable,      lfoNoise
        SSET    vfLfoWrap,       2000h
        SSET    vfLfoDepth,      3E8h
        SSET    vfLfoRate,       10h
        SSET    vfPeriodAdd,     0FFCEh
        SSET    vfLoopCounterA,  20
tuneA17_v0_loop:
        SSET    vfPeriod,        1388h
        SWAIT   1
        SSET    vfLevel,         0
        SWAIT   1
        SSET    vfLevel,         3
        SSET    vfPeriod,        7530h
        SWAIT   1
        SLOOP   vfLoopCounterA, tuneA17_v0_loop
        SSET    vfLevel,         0
        SWAIT   0
tuneA14_v0:
        SSET    vfLevel,         3
        SSET    vfPeriod,        2710h
        SSET    vfLfoTable,      lfoNoise
        SSET    vfLfoWrap,       2000h
        SSET    vfLfoDepth,      1F4h
        SSET    vfLfoRate,       10h
        SSET    vfPeriodAdd,     0FFCEh
        SWAIT   28
        SSET    vfLevel,         0
        SWAIT   0
tuneA15_v0:
        SSET    vfLevel,         3
        SSET    vfPeriod,        4E20h
        SSET    vfLfoTable,      lfoNoise
        SSET    vfLfoWrap,       2000h
        SSET    vfLfoDepth,      2710h
        SSET    vfLfoRate,       10h
        SWAIT   5
        SSET    vfLevel,         0
        SWAIT   1
        SSET    vfLevel,         3
        SSET    vfPeriod,        834h
        SSET    vfLfoDepth,      898h
        SSET    vfPeriodAdd,     64h
        SWAIT   100
        SSET    vfLevel,         0
        SWAIT   0
tuneA08_v0:
        SSET    vfLevel,         3
        SSET    vfPeriod,        0FA0h
        SWAIT   5
        SSET    vfPeriod,        3E8h
        SWAIT   4
        SSET    vfLevel,         0
        SWAIT   0
tuneA09_v0:
        SSET    vfLevel,         3
        SSET    vfPeriod,        36B0h
        SSET    vfPeriodAdd,     0C8h
        SSET    vfLfoTable,      lfoNoise
        SSET    vfLfoWrap,       2000h
        SSET    vfLfoDepth,      1770h
        SSET    vfLfoRate,       7Bh
        SWAIT   8
        SSET    vfLevel,         0
        SWAIT   0
tuneA07_v0:
        SSET    vfLevel,         3
        SSET    vfPeriod,        3FB4h
        SSET    vfLoopCounterA,  30
tuneA07_v0_loop:
        SSET    vfPeriodAdd,     0FE3Ch
        SWAIT   12
        SSET    vfPeriodAdd,     277h
        SWAIT   8
        SLOOP   vfLoopCounterA, tuneA07_v0_loop
        SSET    vfLevel,         0
        SWAIT   0
tuneA02_v0:
        SSET    vfLevel,         3
        SSET    vfLfoTable,      lfoNoise
        SSET    vfLfoWrap,       2000h
        SSET    vfLfoDepth,      640h
        SSET    vfLfoRate,       19Bh
        SSET    vfPeriod,        10CCh
        SSET    vfPeriodAdd,     0Ah
        SWAIT   30
        SSET    vfLfoDepth,      384h
        SSET    vfPeriod,        514h
        SSET    vfPeriodAdd,     50h
        SWAIT   5
        SSET    vfLevel,         0
        SWAIT   0
tuneA05_v0:
        SSET    vfLevel,         3
        SSET    vfLoopCounterA,  5
        SSET    vfPeriod,        1838h
tuneA05_v0_loopOuter:
        SSET    vfPeriodAdd,     0
        SWAIT   6
        SSET    vfLoopCounterB,  12
tuneA05_v0_loopInner:
        SSET    vfPeriodAdd,     0FC5Eh
        SWAIT   1
        SSET    vfPeriodAdd,     384h
        SWAIT   1
        SLOOP   vfLoopCounterB, tuneA05_v0_loopInner
        SLOOP   vfLoopCounterA, tuneA05_v0_loopOuter
        SSET    vfLevel,         0
        SWAIT   0
tuneA03_v0:
        SSET    vfLevel,         3
        SSET    vfPeriod,        197Bh
        SSET    vfLoopCounterA,  10
tuneA03_v0_loop:
        SSET    vfPeriodAdd,     0FFD3h
        SWAIT   20
        SSET    vfPeriodAdd,     1F4h
        SWAIT   1
        SLOOP   vfLoopCounterA, tuneA03_v0_loop
        SSET    vfLevel,         0
        SWAIT   0
tuneA04_v0:
        SSET    vfLevel,         3
        SSET    vfLfoTable,      lfoNoise
        SSET    vfLfoWrap,       2000h
        SSET    vfLfoDepth,      2710h
        SSET    vfLfoRate,       10h
        SSET    vfPeriod,        2EE0h
        SSET    vfLoopCounterA,  44
tuneA04_v0_loop:
        SSET    vfPeriodAdd,     0F1F0h
        SWAIT   2
        SSET    vfPeriodAdd,     0E88h
        SWAIT   2
        SLOOP   vfLoopCounterA, tuneA04_v0_loop
        SSET    vfLevel,         0
        SWAIT   0
tuneA06_v0:
        SSET    vfLevel,         3
        SSET    vfLfoTable,      lfoNoise
        SSET    vfLfoWrap,       2000h
        SSET    vfLfoDepth,      0A28h
        SSET    vfLfoRate,       10h
        SSET    vfPeriod,        1770h
        SSET    vfPeriodAdd,     0FF60h
        SWAIT   30
        SSET    vfPeriodAdd,     46h
        SWAIT   35
        SSET    vfLevel,         0
        SWAIT   0
silentA:
        SSET    vfLevel,         0
        SWAIT   0
tuneA01_v0:
        SSET    vfLevel,         3
        SSET    vfPeriod,        1388h
        SSET    vfLfoTable,      lfoSine
        SSET    vfLfoWrap,       1000h
        SSET    vfLfoDepth,      1F4h
        SSET    vfLfoRate,       4Eh
        SSET    vfLoopCounterA,  40
tuneA01_v0_loop:
        SSET    vfPeriodAdd,     0
        SWAIT   2
        SSET    vfPeriodAdd,     0FDADh
        SWAIT   1
        SSET    vfPeriodAdd,     0
        SWAIT   2
        SSET    vfPeriodAdd,     1F4h
        SWAIT   1
        SLOOP   vfLoopCounterA, tuneA01_v0_loop
        SSET    vfLevel,         0
        SWAIT   0
tuneA11_v0:
        SSET    vfLevel,         3
        SSET    vfLfoTable,      lfoSine
        SSET    vfLfoWrap,       1000h
        SSET    vfLfoDepth,      3E8h
        SSET    vfLfoRate,       100h
        SSET    vfPeriod,        0CE4h
        SSET    vfPeriodAdd,     0FFECh
        SWAIT   30
        SSET    vfLevel,         0
        SWAIT   0
tuneA20_v0:
        SCALL   tuneA20_setup
        SWAIT   0
tuneA20_setup:
        SCLEAR  1
        SSET    vfTranspose,     0FFE8h
        SSET    vfEnvBase,       tuneA20_env_v1
        SSET    vfLfoTable,      lfoSine
        SSET    vfLfoWrap,       1000h
        SSET    vfLfoDepth,      28h
        SSET    vfLfoRate,       12Ch
        SCLEAR  2
        SSET    vfTranspose,     0FFE8h
        SSET    vfReleaseLead,   5
        SSET    vfEnvBase,       tuneA20_env_v2
        SSET    vfLfoTable,      lfoSine
        SSET    vfLfoWrap,       1000h
        SSET    vfLfoDepth,      14h
        SSET    vfLfoRate,       78h
        SCLEAR  0
        SSET    vfTranspose,     0FFE8h
        SSET    vfEnvBase,       tuneA20_env_v0
        SSET    vfLfoTable,      lfoSine
        SSET    vfLfoWrap,       1000h
        SSET    vfLfoDepth,      78h
        SSET    vfLfoRate,       0E4h
        SCLEAR  3
        SSET    vfTranspose,     0FFE8h
        SSET    vfEnvBase,       tuneA20_env_v3
        SSET    vfLfoTable,      lfoSine
        SSET    vfLfoWrap,       1000h
        SSET    vfLfoDepth,      78h
        SSET    vfLfoRate,       0E4h
        SSET    vfTempo,         1
        SRET
tuneA20_env_v2:
        SENV    3,               ENV_SETLEVEL
        SENV    0,               0
        SENV    0,               ENV_SETLEVEL
        SENV    0,               0
        SENV    0,               ENV_SETLEVEL
        SENV    0,               0
tuneA20_env_v1:
        SENV    3,               ENV_SETLEVEL
        SENV    0,               16
        SENV    0,               ENV_SETLEVEL
        SENV    0,               0
        SENV    0,               30
        SENV    0,               0
tuneA20_env_v0:
        SENV    3,               ENV_SETLEVEL
        SENV    0,               8
        SENV    0,               ENV_SETLEVEL
        SENV    0,               0
        SENV    0,               30
        SENV    0,               0
tuneA20_env_v3:
        SENV    3,               ENV_SETLEVEL
        SENV    0,               20
        SENV    0,               ENV_SETLEVEL
        SENV    0,               0
        SENV    0,               30
        SENV    0,               0
tuneA19_v0:
        SSET    vfLevel,         3
        SSET    vfPeriod,        0FA0h
        SSET    vfPeriodAdd,     14h
        SWAIT   16
        SSET    vfLevel,         0
        SWAIT   0
tuneB10_v2:
        SSET    vfPeriod,        0BB8h
        SWAIT   28
        SSET    vfPeriod,        3E80h
        SSET    vfPeriodAdd,     0FFE7h
        SWAIT   400
        SWAIT   0
tuneB10_v3:
        SSET    vfPeriod,        1C0h
        SSET    vfLevel,         0EA60h
        SWAIT   28
        SSET    vfLevel,         0C350h
        SSET    vfLevelAdd,      0FF9Ch
        SWAIT   400
        SSET    vfLevel,         0
        SWAIT   0
tuneB12_v2:
        SSET    vfPeriod,        0BB8h
        SWAIT   18
        SSET    vfPeriod,        3E80h
        SSET    vfPeriodAdd,     0FFE7h
        SWAIT   100
        SWAIT   0
tuneB12_v3:
        SSET    vfPeriod,        1C0h
        SSET    vfLevel,         0EA60h
        SWAIT   18
        SSET    vfLevel,         0C350h
        SSET    vfLevelAdd,      0FF9Ch
        SWAIT   100
        SSET    vfLevel,         0
        SWAIT   0
tuneB13_v2:
        SSET    vfPeriod,        2328h
        SSET    vfPeriodAdd,     0FFE7h
        SWAIT   25
        SWAIT   0
tuneB13_v3:
        SSET    vfPeriod,        1C0h
        SSET    vfLevel,         0D6D8h
        SSET    vfLevelAdd,      0FF9Ch
        SWAIT   25
        SSET    vfLevel,         0
        SWAIT   0
tuneB13_v0:
        SSET    vfPeriod,        0FA0h
        SSET    vfLevel,         9C40h
        SSET    vfLevelAdd,      0FF9Ch
        SSET    vfPeriodAdd,     0FF9Ch
        SWAIT   25
        SSET    vfLevel,         0
        SWAIT   0
tuneB18_v2:
        SSET    vfPeriod,        2710h
        SSET    vfPeriodAdd,     0FFE7h
        SWAIT   55
        SWAIT   0
tuneB18_v3:
        SSET    vfPeriod,        1C0h
        SSET    vfLevel,         0EA60h
        SSET    vfLevelAdd,      0FF9Ch
        SWAIT   55
        SSET    vfLevel,         0
        SWAIT   0
tuneB18_v0:
        SSET    vfPeriod,        1B58h
        SRET
// Stream-formatted tail after the return// no song-table entry points here.
tuneB18_v0_tail:
        SNOTE   0, 10, NT_E+3*OCT, 0, 160
        SSET    vfLevelAdd,      0FF9Ch
        SSET    vfPeriodAdd,     0FF9Ch
        SWAIT   55
        SSET    vfLevel,         0
        SWAIT   0
tuneB16_v2:
        SSET    vfPeriod,        1F40h
        SWAIT   40
        SWAIT   0
tuneB16_v3:
        SSET    vfPeriod,        1C0h
        SSET    vfLoopCounterA,  4
tuneB16_v3_loop:
        SSET    vfLevel,         0D6D8h
        SWAIT   5
        SSET    vfLevel,         1
        SWAIT   5
        SLOOP   vfLoopCounterA, tuneB16_v3_loop
        SSET    vfLevel,         0
        SWAIT   0
tuneB17_v2:
        SSET    vfLoopCounterA,  20
tuneB17_v2_loop:
        SSET    vfPeriod,        1770h
        SSET    vfLevel,         0C350h
        SWAIT   1
        SSET    vfPeriod,        1388h
        SSET    vfLevel,         1
        SWAIT   1
        SSET    vfPeriod,        7530h
        SSET    vfLevel,         0C350h
        SWAIT   1
        SLOOP   vfLoopCounterA, tuneB17_v2_loop
        SSET    vfLevel,         0
        SWAIT   0
tuneB14_v2:
        SSET    vfPeriod,        0FA0h
        SWAIT   28
        SWAIT   0
tuneB14_v3:
        SSET    vfPeriod,        1C0h
        SSET    vfLevel,         0C350h
        SWAIT   28
        SSET    vfLevel,         0
        SWAIT   0
tuneB15_v2:
        SSET    vfPeriod,        2710h
        SWAIT   5
        SSET    vfPeriod,        0FA0h
        SSET    vfPeriodAdd,     64h
        SWAIT   100
        SWAIT   0
tuneB15_v3:
        SSET    vfPeriod,        1C0h
        SSET    vfLevel,         0EA60h
        SWAIT   5
        SSET    vfLevel,         0C350h
        SSET    vfLevelAdd,      0FF9Ch
        SWAIT   100
        SSET    vfLevel,         0
        SWAIT   0
tuneB08_v3:
        SSET    vfPeriod,        100h
        SSET    vfLevel,         7530h
        SSET    vfLevelAdd,      3E8h
        SWAIT   20
        SSET    vfLevelAdd,      0FC18h
        SWAIT   40
        SSET    vfLevel,         0
        SWAIT   0
tuneB09_v3:
        SSET    vfPeriod,        180h
        SSET    vfLevel,         0EA60h
        SSET    vfLevelAdd,      0F254h
        SWAIT   16
        SSET    vfLevel,         0
        SWAIT   0
tuneB07_v1:
        SWAIT   4
tuneB07_v0:
        SSET    vfLevel,         0EA60h
        SSET    vfLevelAdd,      0FF9Ch
        SSET    vfPeriod,        0FDE8h
        SSET    vfLoopCounterA,  30
tuneB07_v0_loop:
        SSET    vfPeriodAdd,     0FD8Ah
        SWAIT   12
        SSET    vfPeriodAdd,     276h
        SWAIT   8
        SLOOP   vfLoopCounterA, tuneB07_v0_loop
        SSET    vfLevel,         0
        SWAIT   0
tuneB06_v2:
        SSET    vfPeriod,        7D0h
        SSET    vfPeriodAdd,     5Ah
        SWAIT   20
        SWAIT   0
tuneB06_v3:
        SSET    vfPeriod,        1C0h
        SSET    vfLevel,         0EA60h
        SSET    vfLevelAdd,      0F830h
        SWAIT   20
        SSET    vfLevel,         0
        SWAIT   0
tuneB05_v0:
        SSET    vfPeriod,        9C2h
        SSET    vfLevel,         7530h
        SSET    vfLoopCounterA,  12
tuneB05_v0_loop:
        SSET    vfPeriodAdd,     0FFF7h
        SWAIT   12
        SSET    vfPeriodAdd,     9
        SWAIT   8
        SLOOP   vfLoopCounterA, tuneB05_v0_loop
        SSET    vfLevel,         0
        SWAIT   0
tuneB03_v2:
        SWAIT   20
tuneB03_v1:
        SWAIT   20
tuneB03_v0:
        SSET    vfPeriod,        98E3h
        SSET    vfLevel,         0EA60h
        SSET    vfLevelAdd,      0FF38h
        SSET    vfPeriodAdd,     0FF4Eh
        SWAIT   200
        SSET    vfLevel,         0
        SWAIT   0
tuneB04_v0:
        SSET    vfLevel,         2710h
        SSET    vfLevelAdd,      1F4h
        SSET    vfPeriod,        0FA00h
        SSET    vfPeriodAdd,     0FF10h
        SWAIT   80
        SSET    vfLevelAdd,      0
        SSET    vfLoopCounterA,  44
tuneB04_v0_loop:
        SSET    vfPeriodAdd,     0FB50h
        SWAIT   2
        SSET    vfPeriodAdd,     4D8h
        SWAIT   2
        SLOOP   vfLoopCounterA, tuneB04_v0_loop
        SSET    vfLevelAdd,      0FE61h
        SSET    vfPeriodAdd,     3Ch
        SWAIT   120
        SSET    vfLevel,         0
        SWAIT   0
tuneB04_v2:
        SSET    vfPeriod,        1130h
        SSET    vfPeriodAdd,     0Bh
        SWAIT   188
        SSET    vfPeriodAdd,     0FFF5h
        SWAIT   188
        SWAIT   0
tuneB04_v3:
        SSET    vfPeriod,        1C0h
        SSET    vfLevel,         61A8h
        SSET    vfLevelAdd,      9Fh
        SWAIT   188
        SSET    vfLevelAdd,      0FF61h
        SWAIT   188
        SSET    vfLevel,         0
        SWAIT   0
tuneB02_v3:
        SSET    vfLevelAdd,      960h
        SSET    vfPeriod,        100h
        SWAIT   25
        SSET    vfLevelAdd,      0F6A0h
        SWAIT   25
        SSET    vfLevel,         0
        SWAIT   0
silentB:
        SSET    vfLevel,         0
        SWAIT   0
tuneB01_v0:
        SSET    vfLevel,         0EA60h
        SSET    vfLevelAdd,      0FF15h
        SSET    vfPeriod,        1FE0h
        SSET    vfLoopCounterA,  6
tuneB01_v0_loop:
        SSET    vfPeriodAdd,     1Eh
        SWAIT   16
        SSET    vfPeriodAdd,     0FFE2h
        SWAIT   16
        SLOOP   vfLoopCounterA, tuneB01_v0_loop
        SSET    vfLevel,         0
        SWAIT   0
tuneB01_v1:
        SSET    vfLevel,         0C350h
        SSET    vfLevelAdd,      0FF38h
        SSET    vfPeriod,        4010h
        SSET    vfLoopCounterA,  10
tuneB01_v1_loop:
        SSET    vfPeriodAdd,     42h
        SWAIT   8
        SSET    vfPeriodAdd,     0FFBEh
        SWAIT   8
        SLOOP   vfLoopCounterA, tuneB01_v1_loop
        SSET    vfLevel,         0
        SWAIT   0
tuneB01_v2:
        SSET    vfLevel,         0FDE8h
        SSET    vfLevelAdd,      0FED4h
        SSET    vfPeriod,        36B0h
        SSET    vfLoopCounterA,  8
tuneB01_v2_loop:
        SSET    vfPeriodAdd,     52h
        SWAIT   12
        SSET    vfPeriodAdd,     0FFB2h
        SWAIT   12
        SLOOP   vfLoopCounterA, tuneB01_v2_loop
        SSET    vfLevel,         0
        SWAIT   0
tuneB11_v0:
        SSET    vfLevel,         0EA60h
        SSET    vfLevelAdd,      0FB50h
        SSET    vfPeriod,        34D0h
        SWAIT   30
        SSET    vfLevel,         0
        SWAIT   0
tuneB11_v1:
        SSET    vfLevel,         0EA60h
        SSET    vfLevelAdd,      0FB50h
        SSET    vfPeriod,        8020h
        SWAIT   30
        SSET    vfLevel,         0
        SWAIT   0
tuneB11_v2:
        SSET    vfLevel,         0EA60h
        SSET    vfLevelAdd,      0FB50h
        SSET    vfPeriod,        1770h
        SWAIT   10
        SSET    vfLevel,         0
        SWAIT   0
tuneB20_v0:
        SCALL   tuneB20_setup
        SWAIT   0
tuneB20_setup:
        SCLEAR  1
        SSET    vfReleaseLead,   0Ch
        SSET    vfTranspose,     0FFD3h
        SSET    vfEnvBase,       tuneB20_env_v1
        SSET    vfLfoTable,      lfoSine
        SSET    vfLfoWrap,       1000h
        SSET    vfLfoDepth,      28h
        SSET    vfLfoRate,       12Ch
        SCLEAR  2
        SSET    vfReleaseLead,   7
        SSET    vfTranspose,     0FFD3h
        SSET    vfEnvBase,       tuneB20_env_v2
        SSET    vfLfoTable,      lfoSine
        SSET    vfLfoWrap,       1000h
        SSET    vfLfoDepth,      16h
        SSET    vfLfoRate,       78h
        SCLEAR  0
        SSET    vfReleaseLead,   7
        SSET    vfTranspose,     0FFD3h
        SSET    vfEnvBase,       tuneB20_env_v0
        SSET    vfLfoTable,      lfoZero
        SSET    vfLfoWrap,       200h
        SSET    vfLfoDepth,      0C8h
        SSET    vfLfoRate,       10h
        SSET    vfTempo,         6
        SRET
tuneB20_env_v2:
        SENV    0C350h,          ENV_SETLEVEL
        SENV    9C4h,            4
        SENV    0F830h,          6
        SENV    0,               0
        SENV    0BB80h,          ENV_SETLEVEL
        SENV    0E0C0h,          6
        SENV    0,               ENV_SETLEVEL
        SENV    0,               0
tuneB20_env_v1:
        SENV    9C40h,           ENV_SETLEVEL
        SENV    9C4h,            8
        SENV    0F448h,          5
        SENV    0,               0
        SENV    0AFC8h,          ENV_SETLEVEL
        SENV    0F060h,          11
        SENV    0,               ENV_SETLEVEL
        SENV    0,               0
tuneB20_env_v0:
        SENV    0DEA8h,          ENV_SETLEVEL
        SENV    0FA24h,          6
        SENV    0,               0
        SENV    0,               0
        SENV    0BB80h,          ENV_SETLEVEL
        SENV    0E0C0h,          6
        SENV    0,               ENV_SETLEVEL
        SENV    0,               0
tuneB19_v0:
        SSET    vfPeriod,        1F40h
        SSET    vfLevel,         7530h
        SSET    vfPeriodAdd,     14h
        SSET    vfLevelAdd,      0FF9Ch
        SWAIT   16
        SSET    vfLevel,         0
        SWAIT   0

let intervalId;

// ---------------------------------------------------------------------------
// Playback routines.
// ---------------------------------------------------------------------------
// Channel 0 retains the BIOS periodic low/high-byte setup. The control write
// below selects channel 2// only the period writes address channel 0.
export function InstallSoundTimer() {
	const driver = new SoundDriver()
	if(!intervalId) {
      intervalId =  setInterval(driver.tick, 25)
	}
}

export function UninstallSoundTimer() {
	if (intervalId){
		clearInterval(intervalId);
        oscillators.forEach((oscillator) => {
					oscillator.silence()
				})}
}

class SoundDriver {
	
outputOn        =      1               // zero mutes output while the sequencers keep running
seqBusy         =      0;               // nonzero skips ISR sequencing during voice updates
curTune         =      0;               // tune id loaded// 0 = silent
freqBase        =      0               // note table of the device being ticked
voiceBase: Voice[] | null       =      null               // block array of the device being ticked
spkrVoice: Voice | null       =      null;               // the block currently driving PIT channel 2

tick() {
        if(     this.seqBusy === 0 ){
       this. seqBusy = 1
            this.tickSpeaker()
            this.tickTandy()
       this. seqBusy = 0
			}
		}

// Step the four speaker voices, then drive PIT channel 2 from the first of them
// that came out of voice_step with a level and a duration left.  One channel, so
// once spkrVoice is set the rest of the pass cannot claim it.
tickSpeaker(toSpeaker: ((output?: {divisor: number; gate: number}) => void)) {
        if(     this.curTune === 0){
              toSpeaker()
							return;
				} 
             this.spkrVoice = null
        this.freqBase = spkrFreq
        this.voiceBase = spkrBlocks
	
	for (let curVoice of  this.voiceBase) {
					if     (curVoice.duration !== 0) {
						this.voice_step({curVoice})
						if     (this.spkrVoice === 0 && curVoice.level !== 0 && curVoice.duration !== 0){
								this.spkrVoice = curVoice
					} 
					} 
	}

        if     (this.outputOn === 0 || this.spkrVoice === null) {
              toSpeaker()
							return;
			}

		let     divisor = spkrVoice.outPeriod
		let gate = spkrVoice.level &      3                   // the low two bits are the 61h gate bits
	if (gate === 3) {
		
      let hz = gate === 3 ? PIT_HZ / (divisor === 0 ? 65536 : divisor) : 0;
			toSpeaker({ divisor, gate,})
		}
}

// Step the four Tandy voices, then write all four to the SN76489.  DL walks the
// latch bytes 80h, 0A0h, 0C0h, 0E0h -- voice 0 to voice 2 are tone, and 0E0h is
// the noise voice, which takes no second period byte.

voiceLeft       =      0               // voices still to visit this pass, 4 down to 1
tickTandy() {
        if     (curTune === 0){
              this.tandy_off()
							return;
			}
        this.voiceLeft = 4
        this.freqBase = tandyFreq
        this.voiceBase = tandyBlocks
				i = 0
				this.tandy_loop1()
		}
tandy_loop1(){
        if(     voiceBase[i].duration === 0) {
					      this.tandy_skip1()
								return;
				}
        this.voice_step(voiceBase[i])
				this.tandy_skip1()
			}
tandy_skip1() {
             i++;
        voiceLeft--;
				if (voiceLeft !== 0){
             this.tandy_loop1()
					return;
				}
        if     (this.outputOn === 0) {
              this.tandy_off()
							return;
			}
        this.voiceLeft = 4;
        i = 0
        let     dl = 0x80
				this.tandy_loop2()
			}
tandy_loop2(){
        let     ax = voiceBase[i].outPeriod
        shr     ax, 1                   // AX arrives as the period shifted left 6.
        shr     ax, 1                   //   Two shifts of AX and four of AL leave the
        shr     al, 1                   //   low 4 period bits in AL and the high 6 in
        shr     al, 1                   //   AH -- the chip's two bytes, in order.
        shr     al, 1
        shr     al, 1
        xor     al, dl
        out     0x0C0, al
        cmp     dl, 0x0E0
        jz      tandy_noatt
        mov     al, ah
        out     0x0C0, al
				this.tandy_noatt()
			}
tandy_noatt(){
        mov     ax, 0x0FFFF              // the chip attenuates, so invert the level
        sub     ax, [si].vfLevel
        shr     ah, 1                   // keep the top 4 bits of the inverted level
        shr     ah, 1
        shr     ah, 1
        shr     ah, 1
        mov     al, ah
        xor     al, dl
        add     al, 0x10                 // latch + 10h selects attenuation
        out     0x0C0, al
        add     dl, 20h
        add     si, SIZE VOICE
        dec     ds:[voiceLeft]
        jnz     tandy_loop2
        return;
}
tandy_off() {
        mov     al, 09Fh
        out     0C0h, al
        mov     al, 0BFh
        out     0C0h, al
        mov     al, 0DFh
        out     0C0h, al
        mov     al, 0FFh
        out     0C0h, al
        return;
}

// One tick of one voice: advance the level and pitch slides, fold in the LFO,
// resume the stream if the duration ran out, then advance the envelope.
voice_step({curVoice}){
        push    cx
        push    di
        mov     ax, [si].vfLevelAdd
        add     [si].vfLevel, ax
        mov     ax, [si].vfPeriodAdd
        add     [si].vfPeriod, ax
        sub     dx, dx
        mov     ax, [si].vfLfoPhase
        add     ax, [si].vfLfoRate
        jz      vs_nofreq
        cmp     ax, [si].vfLfoWrap
        jc      vs_store
        sub     ax, [si].vfLfoWrap
				this.vs_store()
			}
vs_store(){
        mov     [si].vfLfoPhase, ax
        mov     cl, 4
        sar     ax, cl                  // phase >> 4 indexes the waveform
        add     ax, [si].vfLfoTable
        mov     di, ax
        mov     ah, [di]                // the sample goes in AH with AL zero, so the
        mov     al, 0                   //   signed multiply leaves sample * depth / 256
        imul    [si].vfLfoDepth         //   in DX, and DX is what the pitch picks up
				this.vs_nofreq()
				}
vs_nofreq(){
        add     dx, [si].vfPeriod
        mov     [si].vfOutPeriod, dx
        cmp     [si].vfGateLen, 0
        jz      vs_dur
        dec     [si].vfGateLen
        jnz     vs_dur
        mov     [si].vfEnvPos, 10h      // the 5th (value,ticks) pair: the release
        mov     [si].vfEnvWait, 1
				this.vs_dur()
			}
vs_dur(){
        dec     [si].vfDuration
        jnz     vs_rel
        call    seq_proc
				this.vs_rel()
			}
vs_rel() {
        cmp     [si].vfEnvWait, 0
        jz      vs_done
        dec     [si].vfEnvWait
        jnz     vs_done
				this.vs_relloop()
			}
vs_relloop(){
        mov     bx, [si].vfEnvBase
        add     bx, [si].vfEnvPos
        cmp     word ptr [bx+2], ENV_SETLEVEL
        jnz     vs_relset
        mov     ax, [bx]
        mov     [si].vfLevel, ax
        cmp     ax, 0
        jnz     vs_relskip
        mov     [si].vfLevelAdd, ax     // a zero level stops the slide with it
				this.vs_relskip();
				}
vs_relskip() {
        add     [si].vfEnvPos, 4
        jmp     vs_relloop
				this.vs_relset()
			}
vs_relset(){
        mov     ax, [bx]
        mov     [si].vfLevelAdd, ax
        mov     ax, [bx+2]
        mov     [si].vfEnvWait, ax
        add     [si].vfEnvPos, 4
				this.vs_done()
				}
vs_done(){
        pop     di
        pop     cx
        ret
}

// Run this voice's stream until it yields.  DI is the stream cursor throughout.
seq_proc:
        mov     di, [si].vfStream
        cmp     di, 0
        jnz     seq_go
        ret
seq_go:
        mov     ds:[seqVoice], si
seq_loop:
        mov     bl, [di]
        inc     di
        cmp     bl, 0FAh
        jnc     seq_cmd
        jmp     seq_note
seq_cmd:
        sub     bh, bh
        sub     bl, 0FAh
        add     bl, bl
        jmp     cmdTable[bx]
seq_c_loop:                             // 0FEh  SLOOP
        mov     bl, [di]
        inc     di
        mov     bh, 0
        mov     ax, [di]
        add     di, 2
        cmp     word ptr [bx+si], 0
        jz      seq_c_loop_set
        dec     word ptr [bx+si]
        jz      seq_loop
seq_c_loop_set:
        mov     di, ax
        jmp     seq_loop
seq_c_clear:                            // 0FDh  SCLEAR
        mov     si, [di]
        add     di, 2
        add     si, ds:[voiceBase]
seq_c_reset:                            // 0FAh  SRESET -- and SCLEAR's tail
        sub     bx, bx
        mov     [si].vfPeriod, bx
        mov     [si].vfPeriodAdd, bx
        mov     [si].vfOutPeriod, bx
        mov     [si].vfLevel, bx
        mov     [si].vfLevelAdd, bx
        mov     [si].vfReleaseLead, bx
        mov     [si].vfTranspose, bx
        mov     [si].vfEnvBase, bx
        mov     [si].vfEnvPos, bx
        mov     [si].vfEnvWait, bx
        mov     [si].vfLfoTable, bx
        mov     [si].vfLfoPhase, bx
        mov     [si].vfLfoRate, bx
        mov     [si].vfLfoDepth, bx
        mov     [si].vfLfoWrap, bx      // vfDuration, vfStream, vfTempo, vfGateLen
        jmp     seq_loop                //   and both loop counters survive a reset
seq_c_set:                              // 0FFh  SSET
        mov     bl, [di]
        inc     di
        mov     bh, 0
        mov     ax, [di]
        inc     di
        inc     di
        mov     [bx+si], ax
        cmp     bl, 0                   // field 0 is vfDuration, i.e. SWAIT, and a
        jnz     seq_loop                //   SWAIT always yields
seq_end:
        mov     si, ds:[seqVoice]
        cmp     [si].vfDuration, 0
        jnz     seq_e_set
        mov     bl, 4                   // 4 - voiceLeft is this voice's index
        sub     bl, ds:[voiceLeft]
        sub     bh, bh
        mov     voiceTune[bx], 0
        mov     di, 0
seq_e_set:
        mov     [si].vfStream, di
        ret
seq_c_ret:                              // 0FBh  SRET
        mov     di, ds:[seqRet]
        jmp     seq_loop
seq_c_call:                             // 0FCh  SCALL
        mov     ax, [di]
        add     di, 2
        mov     ds:[seqRet], di
        mov     di, ax
        jmp     seq_loop

// A note record: voice index and unused low bits, then the last flag and the pitch,
// then the duration.  Records run back to back until one carries the last flag.
seq_note_b:
        mov     bl, [di]
        inc     di
seq_note:
        push    di
        mov     al, bl
        mov     cl, 5
        shr     al, cl
        mov     cl, al                  // CL = the voice this note is for
        mul     ds:[blockSize]
        add     ax, ds:[voiceBase]
        mov     di, ax                  // DI = that voice's block
        pop     bx
        push    bx
        mov     ax, [si].vfTempo
        cmp     al, 1
        ja      sn_mul
        xor     ah, ah
        mov     al, [bx+1]
        jmp     short sn_store
sn_mul:
        mul     byte ptr [bx+1]
sn_store:
        mov     [si].vfDuration, ax
        mov     al, [bx]                // the last flag and the pitch share this byte
        and     ax, 7Fh
        cmp     ax, REST
        jz      sn_tail
        cmp     cl, 0                   // DI was worked out for voice CL, but only
        ja      sn_tail                 //   voice 0 ever gets a pitch written
        mov     cx, [si].vfDuration
        mov     [di].vfDuration, cx
        mov     [di].vfGateLen, cx
        add     ax, [di].vfTranspose
        mov     [di].vfEnvPos, 0
        mov     [di].vfEnvWait, 1
        mov     cx, 0FFh                // CL wraps to 0 on the first inc below
sn_oct:
        inc     cl
        sub     ax, OCT
        jnc     sn_oct
        add     ax, OCT                 // CL = octave, AX = semitone
        mov     bx, ax
        add     bx, bx
        cmp     di, offset tandyVoice3  // Both branches continue at the next instruction.
        jnz     sn_notspec
sn_notspec:
        add     bx, ds:[freqBase]
        mov     ax, [bx]
        shr     ax, cl
        mov     [di].vfPeriod, ax
        mov     [di].vfOutPeriod, ax
sn_tail:
        pop     di
        mov     al, [di]
        inc     di
        inc     di
        and     al, 80h
        jnz     sn_more
        jmp     seq_note_b
sn_more:
        jmp     seq_end
}

// Start a tune: clear each voice block that the tune gives a stream for, point it
// at that stream and arm it to step on the next tick.  seqBusy keeps the ISR out.
ProgramSpeakerVoices:
        push    bp
        mov     bp, sp
        push    ax
        push    bx
        push    di
        push    si
        push    ds
        mov     si, CODE
        mov     ds, si
        mov     si, [bp+6]              // the tune id
        mov     ds:[curTune], si
        add     si, si
        add     si, si
        add     si, si                  // * 8: four words per table row
        mov     ds:[seqBusy], 1
        mov     ds:[voiceLeft], 4
        mov     di, offset spkrBlocks
vwa_loop:
        mov     ax, songTableA[si]
        cmp     ax, 0
        jz      vwa_next
        mov     bx, SIZE VOICE - 2
vwa_clr:
        mov     word ptr [bx+di], 0
        sub     bx, 2
        jge     vwa_clr
        mov     [di].vfStream, ax
        mov     bl, 4
        sub     bl, ds:[voiceLeft]
        sub     bh, bh
        mov     ax, ds:[curTune]
        mov     voiceTune[bx], al
        mov     [di].vfDuration, 1
vwa_next:
        add     di, SIZE VOICE
        add     si, 2
        dec     ds:[voiceLeft]
        jnz     vwa_loop
        mov     ds:[seqBusy], 0
        pop     ds
        pop     si
        pop     di
        pop     bx
        pop     ax
        pop     bp
        retf    2

ProgramTandyVoices:
        push    bp
        mov     bp, sp
        push    ax
        push    bx
        push    di
        push    si
        push    ds
        mov     si, CODE
        mov     ds, si
        mov     si, [bp+6]
        mov     ds:[curTune], si
        add     si, si
        add     si, si
        add     si, si
        mov     ds:[seqBusy], 1
        mov     ds:[voiceLeft], 4
        mov     di, offset tandyBlocks
vwb_loop:
        mov     ax, songTableB[si]
        cmp     ax, 0
        jz      vwb_next
        mov     bx, SIZE VOICE - 2
vwb_clr:
        mov     word ptr [bx+di], 0
        sub     bx, 2
        jge     vwb_clr
        mov     [di].vfStream, ax
        mov     bl, 4
        sub     bl, ds:[voiceLeft]
        sub     bh, bh
        mov     ax, ds:[curTune]
        mov     voiceTune[bx], al
        mov     [di].vfDuration, 1
vwb_next:
        add     di, SIZE VOICE
        add     si, 2
        dec     ds:[voiceLeft]
        jnz     vwb_loop
        mov     ds:[seqBusy], 0
        pop     ds
        pop     si
        pop     di
        pop     bx
        pop     ax
        pop     bp
        retf    2

SetSoundOutputEnabled:
        push    bp
        mov     bp, sp
        push    ax
        push    ds
        mov     ax, CODE
        mov     ds, ax
        mov     ax, [bp+6]
        mov     ds:[outputOn], al
        pop     ds
        pop     ax
        pop     bp
        retf    2

// CODE    ENDS
//         END
