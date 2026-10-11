#!/usr/bin/env bash
# Cuts the generated music bed to the edit (see src/theme.ts: offset 1.1 s, drop on frame 450).
#  video 1.10-4.97  music 0.00-3.87   muffled (low-pass) under the cold open
#  video 4.97-14.70 music 3.87-13.60  V1, full band
#  video 14.70-15.00 silence before the drop
#  video 15.00-26.70 music 13.90-25.60 V2
#  video 26.70-27.00 silence before the end card
#  video 27.00-     music 27.00-end   final hit and tail
set -euo pipefail
cd "$(dirname "$0")/../public/audio"
f=0.012
ffmpeg -loglevel error -y -i music.mp3 -filter_complex "
[0]asplit=4[a][b][c][d];
[a]atrim=0:3.87,asetpts=PTS-STARTPTS,lowpass=f=380,lowpass=f=380,volume=1.6,afade=t=out:st=3.80:d=0.07[s1];
[b]atrim=3.87:13.60,asetpts=PTS-STARTPTS,volume=1.3,afade=t=in:d=$f,afade=t=out:st=9.66:d=0.07[s2];
[c]atrim=13.90:25.60,asetpts=PTS-STARTPTS,volume=1.7,afade=t=in:d=$f,afade=t=out:st=11.62:d=0.08[s3];
[d]atrim=27.00,asetpts=PTS-STARTPTS,afade=t=in:d=$f[s4];
anullsrc=r=44100:cl=stereo,atrim=0:1.10[z0];
anullsrc=r=44100:cl=stereo,atrim=0:0.30[z1];
anullsrc=r=44100:cl=stereo,atrim=0:0.30[z2];
[z0][s1][s2][z1][s3][z2][s4]concat=n=7:v=0:a=1,alimiter=limit=0.95:level=false[out]" -map "[out]" -ar 44100 -ac 2 music-edit.wav
ffprobe -v error -show_entries format=duration -of csv=p=0 music-edit.wav
