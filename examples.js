var examples = {};

examples.adventure = `#T Adventure
#A Evan Owen
#C (c) 2012

; ******** SQUARE 1 ********
#1 q200

[1]

v11 i15 s200 y1 o2
B8. e8. b8 a4. g16 f#16 g4. f#16 e16 f#8. e8. d8 o3
E8. G8. d8 c#4. B16 A16 c8. B8. A8 B8. G8. F#8 o2
B8. e8. b8 a4. g16 f#16 g4. f#16 e16 f#8. e8. d8 o3
E8. G8. d8 c#4. e16 f#16 d#8. e8. f#8 g4 f#4 o2

[2]

y0 o3
|: E8. c16 r8 (B8 B8) A8 B16 A16 F#16 r16 G8. D16 r8 o2 (B8 B4) B4 |
c8. a16 r8 (g8 g8) f#8 g16 f#16 d8 e8. d16 r8 (e8 e4) r4 o3 :|
c8. a16 r8 c8 c#8. g16 r8 e8 g4. a16 g16 f#2

j[1] x

; ******** SQUARE 2 ********
#2

[1]

v11 i15 s200 y1 o2
G8. B8. e8 c#8. e16 d16 e16 c#8 c8. e16 d16 e16 c8 d8. A8. F#8
G8. B8. e8 a8. b16 a16 g16 e8 e8. f#8. e8 d8. B8. A8
G8. B8. e8 c#8. e16 d16 e16 c#8 c8. e16 d16 e16 c8 d8. A8. F#8
G8. B8. e8 a8. b16 a16 b16 o3 c8 B8. c#8. d#8 e4 d#4 o2

[2]

y0 o2
|: c8. e16 r8 (d8 d8) c8 d16 c16 A16 r16 B8. A16 r8 (G8 G4) G#4 |
A8. c16 r8 (B8 B8) A8 B16 A16 F#8 G8. F#16 r8 (G8 G4) r4 :|
A8. f#16 r8 A8 A#8. e16 r8 c#8 e4. f#16 e16 d#2

j[1] x

; ******** TRIANGLE ********
#3 s210 i40 o3

[1]

e8. E8. G8 A4. A8 c4. c8 d8. e8. f#8
e8. E8. G8 A4. A8 c4. c8 b8. b8. d8
e8. E8. G8 A4. A8 c4. c8 d8. e8. f#8
e8. E8. G8 A4. A8 B8. d#8. f#8 ;b4 B4
i21 l16 a a a a e e A A l4 i40

[2]

|: A8. a16 r8 (A8 A4) D4 G8. g16 r8 (G8 G4) E4 |
A8. a16 r8 (g8 g4) d4 e8. d16 r8 (e8 e4) r4 :|
A8. d#16 r8 a8 a#8. e16 r8 A#8 B8. f#16 r8 (b8 b4) B4

j[1] x

; ******** NOISE ********
#4 s150 v10 i0

; E = bass drum
; A = snare drum
; c = open hi-hat/crash
; d = closed hi-hat

[1]

|: E8 E16 E16 A8 E8 :|3 c8 E16 c8 E16 c8
|: E8 E16 E16 A8 E8 :|3 c8 E16 c8 E16 c8
|: E8 E16 E16 A8 E8 :|3 c8 E16 c8 E16 c8
|: E8 E16 E16 A8 E8 :|3 E8 r8 E8 r8

[2]

|: E8 r16 A8 r16 E8 r8 E16 E16 A8 E8 :|3
c8 E16 c8 E16 c8 E8 {d16 d16 d16} A8 A8
|: E8 r16 A8 r16 E8 r8 E16 E16 A8 E8 :|2
E8 r16 A8 r16 E8 E8 r16 A8 r16 E8
E8 E16 E16 A8 E8 E8 E8 A16 A16 A16 A16

j[1] x`;

examples.bacham = `#T Two-Part Invention in A Minor
#A Johann Sebastian Bach

#I i0 a30 d30 s160 r4

; *** SQUARE 1 ***

#1 q120 i0 l16 v15 y1 o3

r E A c B E B d c8 e8 G#8 e8
A E A c B E B d c8 A8 r4
r e c e A c E G F8 A8 d8 f8
r d B d G B D F E8 G8 c8 e8
r c A c F8 d8 r B G B E8 c8
r A F A D8 B8 c8 r8 r4

r G c e d G d f e8 g8 B8 g8
c G c e d G d f e8 c8 g8 e8
c' a e a c e A c d8 f#8 a8 c'8
b g d g B d G B c8 e8 g8 b8
a f# d# f# B d# F# A G8 g8 r e c e
A8 f#8 r d B d G8 e8 r c A c

F# g f# e d# f# B d# e8 r8 r4
r g bb g e g c# e g e c# e A r r8
r f a f d f B d f d B d G r r8
r e g e c e A c d# c A c F# r r8
r d f d B d G# B d B G# B E r r8
r E A c B E B d c8 A8 G#8 E8

A c e c A c F# A c A F# A D# c B A
G# B d B G# B D F o2 g# f d f B f e d
c e a e c e A c d# c A c F# c B A
G#8 o3 B8 G#8 E8 r E A c B E B d
c A c e d B d f e c e g f e d c
B c d e f d g# d b d c a f d B d
G# B c A E A B G# A E C E o2 A4

x

; *** SQUARE 2 ***

#2 i0 l16 v15 y1 o1

A8 a4 g#8 a e a c' b e b d'
c'8 a8 g#8 e8 a e a c' b e b d'
c'8 a8 c'8 a8 d' a f a d f A c
B8 d8 g8 b8 r g e g c e G B
A8 c8 d f B d G8 B8 c e A c
F8 D8 G g f g c g c' e' d' g d' f'

o2
e8 c8 B8 G8 c G c e d G d f
e8 c8 r4 r g e g c e G B
A8 c8 e8 g8 f# a d f# A d F# A
G8 B8 d8 f#8 e g c e G c E G
F#8 A8 B8 d#8 r e c e A c e g
f# d B d G B d f# e c A c F# A c8

r B c A B8 o1 B8 e e' b g e B G B
E8 e8 g8 bb8 c#8 r8 r o2 g f e
d8 o1 d8 f8 ab8 B8 r8 r o2 f e d
c8 o1 c8 e8 f#8 A8 r8 r o2 e d# c#
B8 o1 B8 d8 f8 G#8 r8 r o2 d c B
c8 A8 G#8 E8 A E A c B E B d

c e a e c e A c F# A c A F# A D# F#
o1 e8 g#8 b8 g#8 e8 B8 G#8 E8
A8 c8 e8 c8 A8 c8 D#8 r8
r b g# e d b g# d l8 c e G# e
A f# B g# c a d bb
g# f d B G# A D E
F D# E e A2

x

#3 x
#4 x`;

examples.bachbbm = `#T Two-Part Invention in B Flat Major
#A Johann Sebastian Bach

#I i0 a30 d30 s160 r4

; *** SQUARE 1 ***

#1 q176 i0 l8 v15 y2 o3

r Bb16 c16 d16 c16 Bb f d bb f
d f16 eb16 d16 eb16 f Bb d F Ab
G Eb16 F16 G16 F16 Eb Bb G eb Bb
G Bb16 Ab16 G16 Ab16 Bb Eb G C Eb
o2 A o3 C16 D16 Eb16 D16 C A F c A
eb F16 G16 A16 G16 F c A f c
d4 r4 r8 g16 f16 eb16 f16 g
c4 r4 r8 f16 eb16 d16 eb16 f
Bb4 r4 r eb16 d16 c16 d16 eb
A c16 Bb16 A16 Bb16 c F4 r4
f4 F4 A4 c4 f2 r2
r4 F4 Bb4 d4 f2 r2
r4 G4 Bb4 c4 e2 r2
r F16 G16 A16 G16 F c A f c
a eb16 d16 c16 d16 eb A c F# A
Bb4 d4 Bb4 G4 Ab4 f4 Ab4 F4
G C16 D16 Eb16 D16 C G Eb c G
d Ab16 G16 F16 G16 Ab D F o2 B o3 G
Eb4 r4 r C16 D16 Eb16 D16 C
c4. Bb A F16 G16 A16 G16 F
f4. eb d Bb16 c16 d16 c16 Bb
bb4. ab g bb16 ab16 g16 ab16 bb
l16 eb8 g f eb f g8 c8 eb d c d eb8
A8 c d eb d c8 f8 Ab G F G Ab8
G8 Bb c d c Bb8 eb8 G F Eb F G8
F8 A Bb c Bb A8 d8 F Eb D Eb F8
Eb8 G A Bb A G8 c8 Eb D C D Eb8
D2 r8 Bb c d c Bb8 l8
f d bb f d f16 eb16 d16 eb16 f
Bb eb Bb eb G Eb16 F16 G16 F16 Eb
Bb G eb Bb G Bb16 Ab16 G16 Ab16 Bb
Eb4 eb4. eb16 d16 c16 d16 eb
F4 eb4. c16 d16 eb16 d16 c
f d16 c16 Bb16 c16 d F Bb c A Bb0

x

; *** SQUARE 2 ***

#2 i0 l8 v15 y2 o1

bb4 Bb4 d4 f4 bb2 r2
r4 Bb4 eb4 g4 bb2 r2
r4 Bb4 c4 eb4 a2 r2 o2
r Bb16 c16 d16 c16 Bb eb4 r4
r A16 Bb16 c16 Bb16 A d4 r4
r G16 A16 Bb16 A16 G c C16 D16 Eb16 D16 C
F4 o1 F4 o2 R8 c A F
r F16 G16 A16 G16 F c A f c
A c16 Bb16 A16 Bb16 c F A C Eb
D o1 Bb16 c16 d16 c16 Bb f d bb f
d f16 eb16 d16 eb16 f Bb d G Bb
E G16 A16 Bb16 A16 G e c g e
bb c16 d16 e16 d16 c g e c' g
a4 c'4 a4 f4 f#4 a4 f#4 d4
g G16 A16 Bb16 A16 G d Bb g d
bb ab16 g16 f16 g16 ab d f Bb d
eb4 g4 eb4 c4 B4 d4 B4 G4
c C16 D16 Eb16 D16 C c4. Bb
A F16 G16 A16 G16 F f4. eb
d Bb16 c16 d16 c16 Bb bb4. ab
g eb16 f16 g16 f16 eb o2 eb4. d
l16 c8 eb d c d eb8 A8 c Bb A Bb c8
F8 A Bb c Bb A8 d8 F Eb D Eb F8 o1
eb8 g a bb a g8 c'8 eb d c d eb8
d8 f g a g f8 bb8 d c Bb c d8
c8 eb f g f eb8 a8 c Bb A Bb c8
Bb8 o2 Bb c d c l8 Bb f d bb f
d f16 eb16 d16 eb16 f Bb d F Ab
G Eb16 F16 G16 F16 Eb Bb G eb Bb
G Bb16 Ab16 G16 Ab16 Bb Eb G o1 Bb d
c F16 G16 A16 G16 F c A eb c
A c16 Bb16 A16 Bb16 c F A C Eb
D Bb16 c16 d16 c16 Bb f4 F4 Bb0 

x

#3 x
#4 x`;

examples.bachbm = `#T Two-Part Invention in B Minor
#A Johann Sebastian Bach

#I i0 a30 d30 s160 r4

; *** SQUARE 1 ***

#1 q208 i0 l8 v15 y0 o2

r4 b a# b4 f#8. g32 a32 g4 f#4 b4 f#8. f#32 g32
f#4 e4 c#'4 e8. e32 f#32 e4 d c# d e f# e
f#4 r4 r a g# a b c#' b g# a b a f#
g# a g# f# e# g# f# e# c#'4 f# e# f# a g# b
a b c#' d' |: a32 g#32 :|4 g# f# f#4 h F# E# F#4 C#8. D32 E32
D4 C#4 F#4 C#8. C#32 D32 C#4 h b4 h G#4 h b8. b32 c#'32
b4 a g# a b a e# f#4 h F# E# F#4 C#4 h
o3 d e d B e B f# B g a g e a e b d
c# d c# A d A e A f# g f# d g d a d
b c' b e a b a d g a g c# f# g f# d
e8. o2 g32 a32 g f# g4 e'4 f#4 d'4 e4 c#'4
d'4 r4 r8 f# e f# g a g e f# g f# d
e f# e d c# e d c# d4 a4 d' c#' b d'
c#' b a g# a4 e8. f#32 g32 f#4 e4 a4 e8. e32 f#32
e4 d4 b4 d8. d32 e32 d4 c# B c# d# e d#
o3 A F# G A G# A# B A# e c# d e d# e# f# e#
b g# a B c# d# e d# a f# g A B c# d c#
g e f# c# d e f# d e f# e c# d e d B
c# d c# B A# B c# A# F#4 o2 b a# b4 f#8. g32 a32
g4 f#4 b4 f#8. f#32 g32 f#4 e4 c#'4 e8. e32 f#32
e4 d c# d f# e g f#4. d' |: b32 a#32 :|4 a# b b0

x

; *** SQUARE 2 ***

#2 i0 l8 v15 y0 o1

B2 d2 e2 d2 c#2 A#2 B2 G2
F#4 f# e# f#4 c#8. d32 e32 d4 c#4 f#4 c#8. c#32 d32
c#4 B4 g#4 B8. B32 c#32 B4 A G# A4 B4
c#4 B4 c#4 C#4 F#4. G# A B G# A
B c# B G# A B A F# G# A G# F# E# G# F# E#
F#4 f# e# f#4 c#4 d4 h D C# D E D h a#
b4 a4 g4 f#4 e4 E4 F#4 G4 A4 g4 f#4 e4 d4 D4 E4 F#4
G4 g4 f#4 b4 e4 a4 d4 (d'4
d') e' d' b c#' d' c#' a d' c#' b a g f# g a
d4 d' c#' d'4 a8. b32 c#'32 b4 a4 d'4 a8. a32 b32
a4 g4 e'4 g8. g32 a32 g4 f# e f# g# a g#
a4 e4 d c# B A d e d B c# d c# A
B c# B A G# B A G# A4 a4 g4 f#4
e4 e'4 d'4 c#'4 b4 B4 A4 G#4
F#4 f# g a4 b4 e4 E F# G4 A4
D4 b a# b4 f#8. g32 a32 g4 f#4 b4 f#8. f#32 g32
f#4 e4 c#'4 e8. e32 f#32 e4 d c# d B c# d
e f# e c# d e d B c# d c# B A# c# B A#
B4 b a# b4 g4 d f# e g f#4 F#4 b0

x

#3 x
#4 x`;

examples.blastoff = `#T Blast Off!
#A Evan Owen
#C (c) 2011

; ******** SQUARE 1 ********
#1 q440 r1

[1]
v13 i2 s200 y3 o2
d2. d8 f8 a2. g8 a8 bb4. a4. g4 eb2. f8 eb8
d4. A4. d4 f4. e4. d4 (c2 i3 c2) i2 f4. e4. c4

d2. d8 f8 a2. g8 a8 bb4. h C4. D4 h a2. g8 a8
bb4. h C4. D4 D4. E4. F4 F2. G8 F8 (E2 i3 E2) h

[2]
v10 i7 s225 y2 o3
(f2 i11 f2) i7 (c2 i11 c4) i7 f4 e4. d4. e4 f2 r4

v12 i15 y0 o2
a bb4. d4. bb4 a4. c4. a
g2. f8 g16 f16 (e2 i16 e2)

v10 i7 s225 y2 o3
(f2 i11 f2) i7 (c2 i11 c4) i7 f4 e4. a4. g4 f2 r4

v12 i15 y0 o3
G4 G#4. B4. G#4
d4. f4. d4 e8 f8 e8 f8 e8 f8 e8 f8 (e2 i16 e2) j[1] x

; ******** SQUARE 2 ********
#2 r1

[1]
v12 i6 s230 y0 o3 l8
|: f A d f a d f a h
D h a f d a f d A |
eb G Bb eb g Bb eb g
bb g eb Bb g eb Bb eb :|
c E G c e G c e

v9 i2 s200 y3 o2
a4. g4. e4

v12 i6 s230 y0 o3
f A d f a d f a h
D h a f d a f d A
d F Bb d d Bb d f
a f# d A f# d A F#

v9 i2 s200 y3 o3
G4. A4. Bb4 B4. c#4. d4 d2. e8 d8 (c#2 i3 c#2)

[2]
|: v11 i6 s230 y1 o2
d d Bb d d Bb d Bb
e e c e e c e c
g g e g g e g e
a a f a a f

v10 s225 i15 y0 | o2
c4 d4. Bb4. d4 c4. A4. c4
e2. d8 e16 d16 (c2 i16 c2) :|

o3
E4 F4. G#4. F4 B4. d4. B4
c#8 d8 c#8 d8 c#8 d8 c#8 d8 (c#2 i16 c#2) j[1] x

; ******** TRIANGLE ********
#3 r1

[1]
s220 i40 o3

|: D D8 D8 D D8 D8 D8 A8 D8 D8 d8 d8 D |
Eb Eb8 Eb8 Eb Eb8 Eb8 Eb8 Bb8 Eb8 Eb8 eb8 eb8 Eb :|
C C8 C8 C C8 C8 F4. E4. C4

D D8 D8 D D8 D8 D8 A8 D8 D8 d8 d8 D
Bb Bb8 Bb8 Bb Bb8 Bb8 F# F#8 F#8 F# F#8 F#8
G G8 G8 G G8 G8 G# G#8 G#8 G# G#8 G#8
A A8 A8 A A8 A8 a8 a8 A8 A8 a8 a8 A8 A8

[2]
Bb8 r4 Bb4. Bb4 c2. c4
E8 r4 E4. E4 F2. F4
Bb8 r4 Bb4. Bb4 F8 r4 F4. F4

c1 i21 l8 a a a a e e A A l4 i40

Bb8 r4 Bb4. Bb4 c2. c4
c#8 r4 c#4. c#4 d2. d4
G#4. g#4. G#4 G#4. g#4. G#4
A4. a4. A4 A8 A8 G8 G8 F8 F8 E8 E8 j[1] x

; ******** NOISE ********
#4 r1

[1]
s90 v11 i0

|: E4 E8 E8 A4 E8 E8 E8 A8 E8 E8 A4 E4 |
E4 E8 E8 A4 E8 E8 E8 A8 E8 E8 A4 A8 A8 :|
E4 E8 E8 A4 E8 E8 c4 E8 c4 E8 c4

|: E4 E8 E8 A4 E8 E8 E8 A8 E8 E8 A4 E4 |
E4 E8 E8 A4 E8 E8 E8 A8 E8 E8 A4 A8 A8 :|
E4 E8 E8 A4 E8 E8 d8 d8 E8 E8 A8 A8 A8 A8

[2]
|: E4. A4. E4 E4 E8 E8 A4 E4
E4. A4. E4 E4 E8 E8 A4 E4
E4 c4 A4 c4 E4 c4 A4 c4
E4 E8 E8 A4 E4 | E2 E2 :|
A8 A8 A8 A8 A8 A8 A8 A8 j[1] x`;

examples.blizzardman = `#T Mega Man VI: Blizzard Man
#A Capcom
#C (c) 1994 Nintendo

; ******** SQUARE 1 ********
; 34/9170
#1 q534

[1] v11 i15 h s225 y3 o1
|: G r2 Bb r2 (d8 i19 d4.) i15 r p100 (f i19 f2) p0 i15 e2 d2
e4 s200 f2 s225 (f8 i19 f4.) i15 c2 | (A A1) G2 F2 :| (a4 i16 a1) i15 g2 f2

[2] s240 y0
|: (g4 i19 g1) i15 bb2 g4 s220 a2 | f2 f2 d2 f4 g2 s240 g2 f4 e4 d4 e1 s220 c1 :|
o2 c2 A2 s200 F2 F4 G2 (G2 i16 G4 G1)

[3] i15 y3 s225
C2 D2 C2 F1 Eb4 D2 Eb2. D2 C2 h bb2 c'4 d'2 s200 (d'2 i16 d'4 d'1)
i15 s225 bb2 d'2 eb'2 f'1 eb'4 d'2 s200 eb'2. s225 eb'2 f'2 h G2 G4 s200 A2 (A1 i16 A4 A1)

[4] i15 s225 Bb2 A2
|: Bb4 A4 Bb4 (c8 i19 c4.) i15 Bb4 | A2 :| A4 c4
d2 c2 Bb2 A2 G2. s200 F2 F4 D4 F4
|: (G4 i19 G1) i15 F2 G4 :| (G1  G1 i16 G1 G1 i15)

j[1] x

; ******** SQUARE 2 ********
#2

[1] v10 i15 s225 y3 o2
|: r1 r4 G Bb d g1 f2 g2 g4 a2 a2 f2 c A Bb c A d c Bb A :|

[2] s255 i18 y1 v11 o3
|: Eb G Bb G d Bb G Bb D F A F c A F A C E G E c G E G | C E G E c G E C :| E C

s250 v10 i15 y3 o2
G2 l8 C D E F G A Bb c l4

[3] s225
|: Bb F Bb d f d Bb F Ab Eb Ab c eb c Ab Eb | G D G Bb d g a bb
v11 i5 s180 y3 h c4 d2 (d4 i20 d1) v10 s225 i15 :|
A F# A d f# d A F# A Bb c d s250 l8 e f# g a bb o3 c d eb o2 l4

[4]
s225 g2. g8 a8 bb4 a4 g4 d4 f2. f8 g8 a4 g4 f4 c4 eb2. eb8 f8 g4 f4 eb4 g4
f4 d4 f4 a2 a4 f4 a4 bb4 g4 eb4 g4 bb4 eb8 f8 g8 f8 eb4
a4 f4 c4 f4 a4 c8 d8 eb8 d8 c4 g4 d4 Bb4 d4 g4 d4 Bb4 d4
s250 g8 G8 A8 Bb8 c8 d8 e8 f#8 g8 a8 bb8 o3 c8 v9 d8 e8 f#8 g8

j[1] x

; ******** TRIANGLE ********
#3

[1] s180 i40 o3
|: G :|16
|: F :|16
|: G :|16
|: F :|16

[2]
|: s180 i40
Eb Eb Eb Eb2 Bb eb Eb
D D D D2 A d A
C C C C2 G c G
C C C C i21 |
s240 a8 a4 r8 A8 A4 r8 :|
s220 r8 a8 a4 e8 e8 A8 A8

[3]
s180 i40
|: Bb :|8 |: Ab :|8 |: G :|12 G Ab Bb G
|: Bb :|8 |: Ab :|8 |: D :|12 D E F# D

[4]
|: G :|8 |: F :|8 |: Eb :|8 |: D :|8
|: Eb :|8 |: F :|8 |: G :|8
G A Bb A s220 i21 l8 a a a a e e A A

j[1] x

; ******** NOISE ********
#4

[1] s90 v11 i17
|: E2 A4 E2 E4 A2
   E2 A4 E2 E4 A2
   E2 A4 E2 E4 A2
   E2 A4 E2 E4 A4 A4 :|

[2]
|: E d d E s15 i0 {d8 d8 d8} s90 i17 d A d
   E d d E d d A d
   E d d E d d A d
   E d d E | E E E E :| E2 E2


[3]
|: E2 A2 E4 E4 A2 E4 E4 A4 E2 E4 | A2 :| A4 s240 v12 c4 s90 v11
|: E2 A2 E4 E4 A2 E4 E4 A4 E2 E4 | A2 :| A4 s240 v12 c4 s90 v11

[4]
|: E4 E4 A4 E4 :|15 E2 E2

j[1] x`;

examples.peacefultown = `#T Peaceful Town
#A Evan Owen
#C (c) 2012

; ******** SQUARE 1 ********
#1 q200 r2

[1]
v11 i2 s220 y2 o4
|: r8 E8 E8 c#8 c#4 d4 c#8 d16 c#16 (B4 i3 B4.) i2 r8
r8 D8 D8 B8 B4 c#4 B8 c#16 B16 (A4 i3 A4.) i2 r8 |
r8 C8 C8 A8 A4 F4 G4. A16 G16 F4 E4 (D4. i3 D4.) i2 C8 D16 C16 o3 (B4. i3 B2) i2 o4 r8 :|
r8 C8 C8 A8 A4 B4 (c4 i3 C4) i2 G4 c4 (d4. i3 d2) i2 c16 d16 (e4. i3 e2) i2 r8

[2]
o3 y3
|: r8 f#8 f#8 f#8 f#8 c#8 c#8 f#8 e8 c#8 (c#4 i3 c#4) i2 r4
r8 e8 e8 e8 e8 B8 B8 e8 (d4. i3 d4.) i2 r4 |
r8 f#8 f#8 f#8 f#8 d8 d8 f#8 g#8 e8 (e4 i3 e4) i2 B4
(c#4. i3 c#4.) i2 c#16 d16 c#16 B16 (c#4. i3 c#4.) i2 r4 :|
r8 f#8 f#8 f#8 f#8 d8 d8 f#8 g#8 e8 (e4 i3 e4) i2 r4
r8 a8 a8 a8 a8 f8 f8 a8 b8 g8 (g4 i3 g4) i2 b4
o4 (c#2 i3 c#1) i2 r2

j[1] x

; ******** SQUARE 2 ********
#2 r2

[1]
v12 i6 s230 y0 o2 l8
|:
A c# e a h C# h a e c#
A d f a b a f d
G# B e g# b g# e B
A c# e a h C# h a e c#
A c f a h C h a f c
G c e g h C h g e c
A d f a b a f d |
G# B e g# b g# e B :|
G# B e g# b4 r4

[2]
v10 i2 s220 y3 o3
|: r8 c#8 c#8 c#8 c#8 A8 A8 c#8 c#8 G#8 (G#4 i3 G#4) i2 r4
r8 B8 B8 B8 B8 G8 G8 B8 (B4. i3 B4.) i2 r4 |
r8 d8 d8 d8 d8 A8 A8 d8 e8 B8 (B4 i3 B4) i2 G#4
(A4. i3 A4.) i2 r4 (E#4. i3 E#4.) i2 r4 :|
r8 d8 d8 d8 d8 A8 A8 d8 e8 B8 (B4 i3 B4) i2 r4
r8 f8 f8 f8 f8 c8 c8 f8 g8 d8 (d4 i3 d4) i2 g4
(a2 i3 a1) i2 r2

j[1] x

; ******** TRIANGLE ********
#3 r2

[1]
s220 i40 o2
|: A1 d2. d4 (e2 e4.) e8 A2. A8 G8 F2. G8 A8 c2. c4 (d2. d8) d8 e2. | E4 :| E8 E#8

[2]
|: F#4. c#8 f#4 F#4 c#2. c#8 d#8
e4. B8 e2 B2. B8 c#8 (d2 d4.) d8 e1 |
A2. A8 B8 c#4 B4 A4 G#4 :|
F8 F8 F8 F8 F8 F8 F8 F8 G8 G8 G8 G8 G8 G8 G8 G8
A2. e4 a2. r4

j[1] x

; ******** NOISE ********
#4 r2

[1]
s90 v11 i0
|: E4 r4 c8 r4 E8 E4 r4 c8 r4. :|8

[2]
|: E4 c8 c8 r4 c8 c8 :|16
c8 r8 c8 r8 c8 r8 c8 r8
c8 r8 c8 r8 c8 r8 c8 r8

j[1] x`;

examples.windman = `#T Mega Man VI: Wind Man
#A Capcom
#C (c) 1994 Nintendo

; ******** SQUARE 1 ********
#1 q315

[1] s230 v11 i2 o1 y3
|: r h Bb d Bb8 F F8 (Bb i3 Bb2) i2 t-2 :|
t0 r Gb Bb Gb8 Db Db8 (Gb i3 Gb) i2 Bb Eb2 Ab2 c2 s200 eb2

[2] s230
|: c8 d d Bb F8 Bb d Bb F Ab. c. (eb i3 eb) i2 d c Bb c8 db db Bb Gb8 Bb |
db c Bb (Ab2 i3 Ab.) i2 r8 Ab Bb c eb :|
c db eb (f2 i3 f.) i2 r8 c2. f

[3] y0 s245
|: (f2 i3 f2) i2 eb d eb f f. eb. (Bb2 i3 Bb2 Bb8) i2 r8 f. eb. (Bb i3 |
Bb2) i2 eb2 eb d c d. r8 Bb d eb :|
i3 Bb) i2 c db eb (f1 i3 f2. f8) i2 r8

[4] y3 s230
(g2 g8) a bb8 a. (f i3 f f16) r16 i2 (a2 i3 a) i2 o2 c c Bb G A
Bb Bb16 r16 (Bb i3 Bb.) i2 r Bb A Bb (c2 i3 c2)
s255 i2 l16 f eb d c Bb A G F o1 eb d c Bb A G F Eb l4 j[2] x

; ******** SQUARE 2 ********
#2

[1] s230 v10 i2 o2 y3
|: r f bb f8 d d8 (f i3 f2) i2 t-2 :|
t0 r db gb db8 Bb Bb8 (db i3 db) i2 gb Ab2 eb2 eb2 ab2

[2] |: h s230 i6 l8
d F Bb d F Bb d F d F Bb d F Bb d F
c Eb Ab c Eb Ab c Ab c Eb Ab c Eb Ab c Ab 
t-2 c Eb Ab c Eb Ab c Ab c Eb Ab c Eb Ab c Ab t0 |
c Eb Ab c Eb Ab c Ab i2 h eb4 f4 ab4 h C4 :|
c F A c F A c F i2 h a2. o3 c4

[3] s200 i5 o2 l4
|: Ab8 c8 f8 (ab2 ab8) g f eb d G8 Bb8 eb8 g. f eb d c Bb Gb8 Bb8 eb8 gb. f eb |
db c Bb Bb8 F8 Bb8 d Bb8 d8 f. f d Bb :| f eb c A8 F8 A8 c A8 c8 f c8 f8 (a2 a8)

[4] s230 i2
(eb2 eb8) f g8 f. c A8 f8 a8 o3 c. o2 a. a bb.
(d2 d8) eb eb8 eb eb8 g8 bb8 o3 eb eb d eb (A2 i3 A2)
s255 i2 z1 o2 h l16
f eb d c Bb A G F Eb D C h bb a g f eb l4 z0 j[2] x

; ******** TRIANGLE ********
#3

[1] s220 i40 o3
(Bb1 i1 Bb2) r4 i40 Bb
(Ab1 i1 Ab2) r4 i40 Ab
(Gb1 i1 Gb2) r4 i40 Gb
Ab2 Ab2 Ab4 Ab4 Ab4 Ab4

[2]
|: Bb r8 Bb8 r8 F8 Ab8 F8 Bb r8 Bb8 r8 F8 Ab8 F8
Ab r8 Ab8 r8 Eb8 F8 Eb8 Ab r8 Ab8 r8 Eb8 F8 Eb8
t-2 Ab r8 Ab8 r8 Eb8 F8 Eb8 Ab r8 Ab8 r8 Eb8 F8 Eb8 t0 |
Ab r8 Ab8 r8 Eb8 F8 Eb8 r8 Ab8 r8 Ab8 r8 Ab8 r8 Ab8 :|
F r8 F8 r8 A8 c8 A8 F r8 F8 r8 A8 c8 A8

[3]
|: Ab r8 (Ab2 Ab8) Ab r8 (Ab2 Ab8) G r8 (G2 G8) G r8 (G2 G8)
Gb r8 (Gb2 Gb8) Gb r8 (Gb2 Gb8) | Bb r8 (Bb2 Bb8) Bb F Bb d :|
F r8 F r8 F r8 F8 r8 F8
i21 l16 g g g B B B E E l4

[4] i40
Eb8 Eb8 r Eb8 Eb8 r8 Eb8
F8 F8 r8 F8 r8 F8 F
F#8 F#8 r F#8 F#8 r8 F#8
G8 G8 r8 G8 r8 G8 G
Eb r Eb8 Eb8 r Eb8 Eb8 r8 Eb8 r8 Eb8 Eb
F r F8 F8 r
l16 f r F8 f r F8 f r F8 f r F8 l4 j[2] x

; ******** NOISE ********
#4

[1] s90 v13 i0
c1 r r2 c
c1 r r2 c
c1 r r2 c
s180 c2 c2
s160 c c
s90 v11 |: A16 :|8

[2]
|: s90 v11
E A8 E E8 A
E A8 E E8 A
E A8 E E8 A
E A8 E E8 A
E A8 E E8 A
E A8 E E8 A
E A8 E E8 A
| v13 s160 c c c c :|
v13 c v11 E8
v13 c v11 E8
s90 l16 A A A A l4

[3]
|: E. E E8 A
E. E E8 A
E. E E8 A
E. E E8 A8 A8 |
E. E E8 A
E. E E8 A
E. E E8 A
E v13 s160 c c v11 s90 l16 A A A A l4 :|
E. E E8 A
E. E E8 A
v13 s160 c E8 c E8 c
v11 s90 E E E r

[4]
|: E A E8 E8 A E8 E8 A8 E E8 A
E A E8 E8 A | E8 E8 A8 E E8 A :|
v13 s160 c c
s90 v11 |: A16 :|8 j[2] x`;

examples.yamatoman = `#T Mega Man VI: Yamato Man
#A Capcom
#C (c) 1994 Nintendo

; ******** SQUARE 1 ********
; 34/94F1
#1 q534 v11 o3 r1

[1] i15 s200 y1
D#4 F#2
|: s170 G#2 G#4 s200 G#2 F#4 G#2 {A#16 (B16 B4} i16 B4) i15 G# F# G# r G# B |
s170 c#2 c#4 s200 c#2 B4 c#2 {d#16 (e16 e4} i16 e4) i15 d#4 c#4 d#4 r4 D#4 F#4 :|
c#2 B c# B c#2 d d#2 A# F# (G# i16 G#2)

[2]
r4 |: i15 y1 s220
G#4. r8 G#8 r8 G#2 F#4 G#2 (B4. B16) r16
B A# B A# G# F# D# s250 |
F#2. A#2. i5 s180 y3 f#2. a#2. h C# h b a# :|
C#2. F#2. i5 s180 y3 c#2. f#2. h C#2 F#2 h

[3] s240 i15 y1
E2. G#2. B2 A# B A# F#4. r8 F#4 A#2 B2. c#2. d#2 c# d# c# G#4. r8 G# B

s180
A#2 A# A# s220 B A# G# F# (D#2 i16 D#2 D#8) r8 i15 A#4 B2
s190
c#2 c#4 s220 d# e d# c# B (d#2 i16 d#2 d#8) r8

[4]
|: i15 d# s190 f#2 g#2 s220 g# f# d# f# d# c# | (d#2 i16 d#2.) i15 r d# f# s190 g#2
s220 g# f# g# a# b a# (g#2 i16 g#2 g#8) r8 :|
d#2 c# B G# r A# B s190 A#2 s220 A# c#2 A# G# F# (G#2 i16 G#2 G#8) i15 r8

j[1] x

; ******** SQUARE 2 ********
#2 r1

[1] s200 v10 o2 i15 y1
Bb4 c#2
|: s170 d#2 d#4 s200 d#2 c#4 d#2 (g#4 i16 g#4) i15 d# c# d# r d# g# |
s170 o3 G#2 G#4 s200 G#2 F#4 G#2 (c#4 i16 c#4) i15 o2 a# g# a# r A# c# :|
g#2 g# g# g# g#2 a a#2 f# c# (d# i16 d#2) i15 r2

[2] y2 v8 s160 i14 h
|: r D# G# D# B A# G# D# r D# G# D# B A# G# D#
r D# F# D# A# G# F# C# r D# F# D# A# G# F# C# :|

[3] s240 v8 i8 y2 h
G# B e B2 f# e B A# c# f# c#2 g# f# c# B d# f# d#2 f# d# B c# e g# e2 b e
s240 i15 z3 y1 v7
a#2 a# a# b a# g# f# (d#2 i16 d#2 d#8) r8 i15 a# b2
s190 h
C#2 C#4 s220 D# E D# C# h b z0 v10 (g2 i16 g2 g8) r8 i15

[4]
|: f# s190 a#2 b2 s220 b a# f# a# f# e |
d#2 e f# d#. r8 f# a# s190 b2 s220 b a# b h C# D# C# h b2 a# f# g# :|
f#2 e d# B r c# d# s190 c#2 s220 c# e2 c# B A# (B2 i16 B2 B8) i15 r8

j[1] x

; ******** TRIANGLE ********
#3 s210 i40 o3 r1

[1]
D# D# r G# |: r G# G#2 D# F# D# G# r G# G#2 G# B G# c# r c# c#2 G# c# G# d# r d# |
d#2 d# A# F# G# :| d# G#2 r4 D#4

[2]
|: G#2 G# B G# c# B F# G#2 G# B G# c# B G# F#2 F# A# F# c# A# G# F#2 F# A# F# c# A# | F# :|

[3]
G# F# E2 r E2 G# B E F#2 r F#2 A# c# A# B2 r B2 c# d# B c#2 r c#2 d# e
d#2 D# D#2 D# F# A# d#2 D# D#2 D# G A# c#2 C# C#2 C# D# E D#2 D# E D# G D# A# D#

[4]
|: G#4. G#8 r G# r G# r D# :|6 D#4. D#8 r D# D# F# A# G# G#2 r2

j[1] x

; ******** NOISE ********
#4 s150 v10 i0

E2 E8 c8 c8 c8 A8 A8 A8 A8 F8 F8 F8 F8

[1]
|: v10 E v9 d v10 A v9 d v10 E E A | E :|8

[2]
s250 v11 c4 s150
|: v10 E v9 d v10 A v9 d v10 | E E A E :|4 E E c8 A8 F
|: v10 E v9 d v10 A v9 d v10 | E E A E :|4 E8 c8 A8 F8 E E

[3]
|: v10 E v9 d v10 A E v9 d v10 E | A v9 d :|6 A8 A8 A
|: v10 E v9 d v10 A E v9 d v10 E | A v9 d :| A8 A8 A

[4]
v10
|: E4. E8 A E2 E A E | E4. E8 A E2 E A2 :|4 c8 A8 F c8 A8 F E8 |: A8 :|7

j[1] x`;