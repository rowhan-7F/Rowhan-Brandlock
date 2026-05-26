"use client";

import { useEffect, useRef } from "react";

/**
 * Swiss Aurora Background v12 - Hero animé WebGL2
 *
 * Améliorations v12 :
 * - Sensibilité souris x3 (mouvement plus présent)
 * - Easing plus rapide (0.035 → 0.08)
 * - Nouvelle grille foreground (cases larges + points d'énergie)
 * - Grille plafond enrichie de points d'énergie qui se baladent
 * - Bouclier complet : inner rings, 4 traces, pads, cardinaux, holo, serial
 */
export default function SwissAuroraBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });

    if (!gl) {
      canvas.style.background =
        "radial-gradient(120% 80% at 50% 60%, #0A1424 0%, #050818 70%, #02030A 100%)";
      return;
    }

    const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main(){
  v_uv = a_pos*0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;
    const FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform vec2  u_res;
uniform float u_time;
uniform vec2  u_mouse;
uniform float u_mouseAct;

const vec3 BG_DEEP    = vec3(0.0196, 0.0314, 0.0941);
const vec3 PCB_BASE   = vec3(0.0392, 0.0784, 0.1647);
const vec3 PCB_HI     = vec3(0.0824, 0.1373, 0.2706);
const vec3 CYAN_DEEP  = vec3(0.1216, 0.6431, 0.7216);
const vec3 CYAN_LIGHT = vec3(0.3020, 0.8157, 0.8824);
const vec3 INK        = vec3(0.9098, 0.9255, 0.9451);
const vec3 INK_DIM    = vec3(0.6588, 0.6824, 0.7176);
const vec3 RED_SWISS  = vec3(0.7843, 0.1333, 0.1098);
const vec3 RED_LIGHT  = vec3(0.9490, 0.4196, 0.3686);
const vec3 GOLD       = vec3(0.7843, 0.6196, 0.3216);

const vec3 AURORA_RED    = vec3(0.7020, 0.1255, 0.2078);
const vec3 AURORA_VIOLET = vec3(0.4039, 0.1647, 0.5294);
const vec3 AURORA_BLUE   = vec3(0.0941, 0.2902, 0.6196);
const vec3 AURORA_PINK   = vec3(0.7686, 0.2706, 0.5020);

#define PI 3.14159265

float h11(float p){ p=fract(p*0.1031); p*=p+33.33; p*=p+p; return fract(p); }
float h21(vec2 p){
  vec3 p3=fract(vec3(p.xyx)*0.1031);
  p3+=dot(p3,p3.yzx+33.33);
  return fract((p3.x+p3.y)*p3.z);
}

float lineAA(float d, float w){
  float aa = fwidth(d) * 1.2;
  return smoothstep(w + aa, w - aa, d);
}

float noise2(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = h21(i);
  float b = h21(i + vec2(1.0, 0.0));
  float c = h21(i + vec2(0.0, 1.0));
  float d = h21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm2(vec2 p){
  float v = 0.0;
  float a = 0.55;
  for (int i = 0; i < 4; i++){
    v += a * noise2(p);
    p *= 2.07;
    a *= 0.5;
  }
  return v;
}

struct Cam { vec3 pos; vec3 fwd; vec3 right; vec3 up; float focal; };
Cam buildCam(vec2 mouse, float t){
  Cam c;
  // SENSIBILITE SOURIS x3 (avant : 0.35 et 0.15)
  float mx = (mouse.x - 0.5) * 1.05;
  float my = (mouse.y - 0.5) * 0.45;
  c.pos = vec3(mx * 0.4 + sin(t * 0.025) * 0.08, 1.3 + my * 0.20, -0.5);
  vec3 target = vec3(mx * 0.6, 0.55 + my * 0.10, 7.0);
  c.fwd = normalize(target - c.pos);
  c.right = normalize(cross(c.fwd, vec3(0.0, 1.0, 0.0)));
  c.up = cross(c.right, c.fwd);
  c.focal = 1.45;
  return c;
}
vec3 rayDir(Cam c, vec2 uv){
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_res.x / u_res.y;
  return normalize(c.fwd * c.focal + c.right * p.x + c.up * p.y);
}

vec3 auroraSky(vec3 rd, vec2 uv, float t){
  float h = clamp(rd.y * 1.4 + 0.3, 0.0, 1.0);
  vec3 col = mix(PCB_BASE, BG_DEEP, smoothstep(0.0, 0.7, h));
  vec2 p = vec2(uv.x * 2.0, uv.y * 1.5);
  vec2 p1 = p + vec2(t * 0.012, sin(t * 0.05) * 0.08);
  float n1 = fbm2(p1 * 1.6 + vec2(0.0, t * 0.015));
  float density1 = smoothstep(0.40, 0.78, n1);
  float mask1 = smoothstep(0.25, 0.85, uv.y) * smoothstep(0.95, 0.25, uv.x + sin(t * 0.03) * 0.2);
  vec2 p2 = p + vec2(-t * 0.009, cos(t * 0.04) * 0.10) + vec2(2.3, 1.7);
  float n2 = fbm2(p2 * 1.4 + vec2(t * 0.012, 0.0));
  float density2 = smoothstep(0.42, 0.80, n2);
  float centerX = 0.5 + sin(t * 0.04) * 0.20;
  float mask2 = smoothstep(0.35, 0.95, uv.y) * exp(-pow((uv.x - centerX) * 1.7, 2.0));
  vec2 p3 = p + vec2(t * 0.015, -t * 0.01) + vec2(-1.9, 0.7);
  float n3 = fbm2(p3 * 1.8 + vec2(0.0, -t * 0.018));
  float density3 = smoothstep(0.38, 0.82, n3);
  float mask3 = smoothstep(0.20, 0.85, uv.y) * smoothstep(0.0, 0.7, uv.x + cos(t * 0.035) * 0.15);
  col += AURORA_RED * density1 * mask1 * 0.55;
  col += AURORA_VIOLET * density2 * mask2 * 0.50;
  col += AURORA_BLUE * density3 * mask3 * 0.60;
  float overlap12 = density1 * density2 * mask1 * mask2;
  float overlap23 = density2 * density3 * mask2 * mask3;
  float overlap13 = density1 * density3 * mask1 * mask3;
  col += AURORA_PINK * overlap12 * 0.35;
  col += CYAN_LIGHT * overlap23 * 0.25;
  col += RED_LIGHT * overlap13 * 0.30;
  float horizon = exp(-abs(rd.y) * 12.0);
  col = mix(col, PCB_HI, horizon * 0.35);
  float fwd = clamp(rd.z, 0.0, 1.0);
  col = mix(col, mix(col, AURORA_RED * 0.7, 0.08), horizon * fwd);
  vec2 c = uv - 0.5;
  float vig = length(c * vec2(1.0, 0.95));
  col *= mix(1.0, 0.55, smoothstep(0.35, 0.85, vig));
  return col;
}

/* GRILLE PLAFOND avec POINTS D'ENERGIE qui se baladent */
vec3 skyPerspectiveGrid(vec3 ro, vec3 rd, float t){
  float ceilingY = 6.5;
  if (rd.y <= 0.001) return vec3(0.0);
  float depth = (ceilingY - ro.y) / rd.y;
  if (depth < 0.1 || depth > 80.0) return vec3(0.0);
  vec3 p = ro + rd * depth;
  float driftZ = t * 0.45;
  vec2 g = vec2(p.x, p.z - driftZ);
  vec2 g1 = abs(fract(g) - 0.5);
  float d1 = min(g1.x, g1.y);
  float w1 = 0.012 + depth * 0.0028;
  float l1 = 1.0 - smoothstep(0.0, w1, d1);
  vec2 g2 = abs(fract(g * 0.2) - 0.5);
  float d2 = min(g2.x, g2.y);
  float w2 = 0.004 + depth * 0.0010;
  float l2 = 1.0 - smoothstep(0.0, w2, d2);
  float fogFar = exp(-depth * 0.045);
  float fogNear = smoothstep(2.0, 6.0, depth);
  float fog = fogFar * fogNear;
  float yMask = smoothstep(0.0, 0.15, rd.y) * smoothstep(0.85, 0.30, rd.y);
  vec3 gridCol = vec3(0.42, 0.45, 0.52);
  vec3 acc = vec3(0.0);
  acc += gridCol * l1 * fog * yMask * 0.18;
  acc += gridCol * l2 * fog * yMask * 0.32;
  
  /* POINTS D'ENERGIE qui se baladent sur les lignes */
  // On parcourt 6 points par "cellule de grille" voisine
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    // Position du point : se balade en X selon le temps
    float lineZ = floor((p.z - driftZ) / 1.0) + h11(fi * 17.3);
    float speed = 1.5 + h11(fi * 5.7) * 1.2;
    float xPath = mod(t * speed + fi * 3.7, 20.0) - 10.0;
    
    // Distance au point d'energie
    vec2 ptPos = vec2(xPath, lineZ + driftZ);
    vec2 dq = vec2(p.x - ptPos.x, p.z - ptPos.y);
    float dist = length(dq);
    
    if (dist > 0.4) continue;
    
    // Halo + core
    float core = exp(-dist * dist * 60.0);
    float halo = exp(-dist * dist * 8.0) * 0.3;
    
    vec3 ptCol;
    if (i < 2)      ptCol = CYAN_LIGHT;
    else if (i < 4) ptCol = AURORA_PINK;
    else            ptCol = AURORA_VIOLET;
    
    acc += ptCol * (core + halo) * fog * yMask * 0.85;
  }
  
  return acc;
}

/* NOUVELLE GRILLE BAS - cases LARGES (4x plus que le sol normal) */
vec3 floorWideGrid(vec3 ro, vec3 rd, float t){
  if (rd.y >= -0.001) return vec3(0.0);
  float depth = -ro.y / rd.y;
  if (depth < 0.1 || depth > 80.0) return vec3(0.0);
  vec3 p = ro + rd * depth;
  
  // Cases LARGES : facteur 0.25 au lieu de 1
  // Drift de la grille vers nous
  float driftZ = -t * 0.45;
  vec2 g = vec2(p.x, p.z - driftZ);
  
  // Grille large : carres de 4 unites
  vec2 g1 = abs(fract(g * 0.25) - 0.5);
  float d1 = min(g1.x, g1.y);
  float w1 = 0.012 + depth * 0.0020;
  float l1 = 1.0 - smoothstep(0.0, w1, d1);
  
  // Grille tres large : carres de 20 unites pour accent
  vec2 g2 = abs(fract(g * 0.05) - 0.5);
  float d2 = min(g2.x, g2.y);
  float w2 = 0.004 + depth * 0.0008;
  float l2 = 1.0 - smoothstep(0.0, w2, d2);
  
  float fogFar = exp(-depth * 0.045);
  float fogNear = smoothstep(2.0, 6.0, depth);
  float fog = fogFar * fogNear;
  
  // Masque hauteur : visible en bas de l'ecran (vers nous, premier plan)
  float yMask = smoothstep(0.0, -0.15, rd.y) * smoothstep(-0.85, -0.30, rd.y);
  yMask = clamp(-rd.y * 2.5, 0.0, 1.0);
  yMask *= smoothstep(0.85, 0.5, abs(rd.y));
  
  // Couleur : bleu glacial pour matcher l'aurora
  vec3 gridCol = vec3(0.35, 0.42, 0.55);
  
  vec3 acc = vec3(0.0);
  acc += gridCol * l1 * fog * 0.22;
  acc += gridCol * l2 * fog * 0.40;
  
  /* POINTS D'ENERGIE qui se baladent sur la grille large */
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float lineZ = floor((p.z - driftZ) * 0.25) * 4.0 + h11(fi * 11.7) * 4.0;
    float speed = 2.0 + h11(fi * 7.3) * 1.5;
    float xPath = mod(t * speed + fi * 5.3, 24.0) - 12.0;
    
    vec2 ptPos = vec2(xPath, lineZ + driftZ);
    vec2 dq = vec2(p.x - ptPos.x, p.z - ptPos.y);
    float dist = length(dq);
    
    if (dist > 0.6) continue;
    
    float core = exp(-dist * dist * 40.0);
    float halo = exp(-dist * dist * 5.0) * 0.4;
    
    vec3 ptCol;
    if (i < 3)      ptCol = CYAN_LIGHT;
    else if (i < 6) ptCol = AURORA_PINK;
    else            ptCol = RED_LIGHT;
    
    acc += ptCol * (core + halo) * fog * 1.0;
  }
  
  return acc;
}

vec3 perspectiveGrid(vec3 ro, vec3 rd, float t){
  if (rd.y >= -0.001) return vec3(0.0);
  float depth = -ro.y / rd.y;
  if (depth < 0.1 || depth > 80.0) return vec3(0.0);
  vec3 p = ro + rd * depth;
  vec3 col = vec3(0.0);
  float fog = exp(-depth * 0.055);
  float fogStrong = exp(-depth * 0.085);
  vec2 xz = p.xz;
  float r = length(xz);
  float ang = atan(xz.y, xz.x);
  {
    float n = 24.0;
    float a = ang * n / (2.0 * PI);
    float ringEdge = abs(fract(a) - 0.5) * 2.0;
    float w = 0.92 + 0.08 * smoothstep(0.0, 20.0, r);
    float lineProx = smoothstep(w, w + 0.01, ringEdge);
    lineProx = 1.0 - lineProx;
    float radMask = smoothstep(2.0, 4.5, r) * smoothstep(80.0, 30.0, r);
    float lineIdx = floor(a);
    float lineHash = h11(lineIdx + 7.3);
    float pulseR = 4.0 + mod(t * 1.8 + lineHash * 26.0, 26.0);
    float pulseDist = abs(r - pulseR);
    float pulse = exp(-pulseDist * pulseDist * 2.5) * lineProx;
    vec3 lineCol;
    if (lineHash < 0.20)      lineCol = AURORA_RED;
    else if (lineHash < 0.50) lineCol = AURORA_VIOLET;
    else if (lineHash < 0.80) lineCol = AURORA_BLUE;
    else                       lineCol = CYAN_LIGHT;
    col += lineCol * lineProx * radMask * fog * 0.10;
    col += lineCol * pulse * radMask * fog * 0.75;
  }
  {
    float ringStep = 4.0;
    float ringPhase = fract(r / ringStep);
    float ringDist = abs(ringPhase - 0.5) * 2.0;
    float w = 0.94;
    float ringMask = smoothstep(w, w + 0.012, ringDist);
    ringMask = 1.0 - ringMask;
    float radMask = smoothstep(2.5, 4.5, r) * smoothstep(70.0, 25.0, r);
    float ringIdx = floor(r / ringStep);
    float ringHash = h11(ringIdx + 11.7);
    float pulseAng = mod(t * (0.20 + ringHash * 0.1) + ringHash * 6.28, 2.0 * PI);
    float angDist = abs(ang - pulseAng);
    angDist = min(angDist, 2.0 * PI - angDist);
    float pulse = exp(-angDist * angDist * 4.0) * ringMask;
    vec3 ringCol;
    if (ringHash < 0.33)      ringCol = AURORA_VIOLET;
    else if (ringHash < 0.66) ringCol = CYAN_DEEP;
    else                       ringCol = AURORA_RED;
    col += ringCol * ringMask * radMask * fogStrong * 0.12;
    col += ringCol * pulse * radMask * fog * 0.65;
  }
  vec2 gFine = abs(fract(p.xz * 0.5) - 0.5);
  float gd = min(gFine.x, gFine.y);
  float w = 0.011 + depth * 0.0018;
  float gridLine = 1.0 - smoothstep(0.0, w, gd);
  col += PCB_HI * gridLine * 0.08 * fogStrong;
  return col;
}

vec3 dataCapsule(vec2 q, float r, float t, vec3 capCol){
  float a = atan(q.y, q.x);
  float hexR = r / cos(mod(a, PI/3.0) - PI/6.0);
  float d = length(q) - hexR;
  vec3 col = vec3(0.0);
  float outline = 1.0 - smoothstep(0.0, 0.005, abs(d));
  col += capCol * outline * 0.8;
  float fill = step(d, 0.0);
  col += capCol * fill * 0.10;
  if (fill > 0.5) {
    for (int b = 0; b < 3; b++){
      float yBar = (float(b) - 1.0) * r * 0.35;
      float dBar = abs(q.y - yBar);
      if (dBar < 0.012) {
        float barLen = (0.4 + h11(float(b) + t * 0.1) * 0.5) * r;
        float lineMask = step(abs(q.x), barLen) * step(dBar, 0.008);
        col += capCol * lineMask * 0.6;
      }
    }
  }
  return col;
}

vec3 lateralBeams(vec3 ro, vec3 rd, float t){
  float planeZ = 9.0;
  if (rd.z < 0.001) return vec3(0.0);
  float depth = (planeZ - ro.z) / rd.z;
  if (depth < 0.1) return vec3(0.0);
  vec3 p = ro + rd * depth;
  vec3 col = vec3(0.0);
  float fog = exp(-depth * 0.045);
  for (int rail = 0; rail < 3; rail++) {
    float fRail = float(rail);
    float railY = mix(0.4, 2.2, fRail / 2.0);
    float dy = abs(p.y - railY);
    if (dy > 0.06) continue;
    float absX = abs(p.x);
    if (absX < 2.3) continue;
    if (absX > 22.0) continue;
    float railLine = 1.0 - smoothstep(0.0, 0.008, dy);
    float xEnv = smoothstep(2.3, 3.5, absX) * smoothstep(22.0, 18.0, absX);
    vec3 railCol;
    if (rail == 0) railCol = AURORA_BLUE;
    else if (rail == 1) railCol = RED_LIGHT;
    else railCol = AURORA_VIOLET;
    col += railCol * railLine * xEnv * fog * 0.35;
    float halo = exp(-dy * 35.0) * 0.20;
    col += railCol * halo * xEnv * fog;
    for (int side = 0; side < 2; side++) {
      float dir = (side == 0) ? -1.0 : 1.0;
      if (dir < 0.0 && p.x > 0.0) continue;
      if (dir > 0.0 && p.x < 0.0) continue;
      float travelLen = 19.7;
      for (int c = 0; c < 4; c++) {
        float fc = float(c);
        float phase = fc * 0.25 + fRail * 0.13 + h11(float(side)*3.0+fc*5.0+fRail) * 0.4;
        float xLocal = 2.3 + mod(t * 3.2 + phase * travelLen, travelLen);
        float xPos = xLocal * dir;
        vec2 capQ = vec2(p.x - xPos, p.y - railY);
        if (length(capQ) > 0.10) continue;
        col += dataCapsule(capQ, 0.06, t, railCol) * fog * 0.95;
      }
    }
  }
  return col;
}

vec3 depthBeams(vec3 ro, vec3 rd, float t){
  if (rd.y >= -0.001) return vec3(0.0);
  float depth = -ro.y / rd.y;
  if (depth < 0.1 || depth > 60.0) return vec3(0.0);
  vec3 p = ro + rd * depth;
  vec3 col = vec3(0.0);
  float fog = exp(-depth * 0.045);
  float railsX[4];
  railsX[0] = -1.0;
  railsX[1] = -0.35;
  railsX[2] =  0.35;
  railsX[3] =  1.0;
  for (int i = 0; i < 4; i++) {
    float xPos = railsX[i];
    float dx = abs(p.x - xPos);
    if (dx > 0.04) continue;
    if (p.z < 0.5 || p.z > 60.0) continue;
    float beamMask = smoothstep(0.5, 1.2, p.z) * smoothstep(60.0, 50.0, p.z);
    float railLine = 1.0 - smoothstep(0.0, 0.015, dx);
    vec3 railCol;
    if (i == 0)      railCol = AURORA_BLUE;
    else if (i == 1) railCol = CYAN_LIGHT;
    else if (i == 2) railCol = CYAN_LIGHT;
    else             railCol = AURORA_VIOLET;
    col += railCol * railLine * beamMask * fog * 0.30;
    {
      float travelLen = 46.0;
      float speed = 5.5 + h11(float(i)) * 0.6;
      for (int c = 0; c < 3; c++) {
        float fc = float(c);
        float phase = fc / 3.0 + h11(float(i)+11.3+fc*2.1) * 0.2;
        float zPos = 9.0 + mod(t * speed + phase * travelLen, travelLen);
        vec2 capQ = vec2(p.x - xPos, p.z - zPos);
        if (length(capQ) < 0.25) {
          float capBar = (1.0 - smoothstep(0.0, 0.015, abs(capQ.x))) * (1.0 - smoothstep(0.0, 0.18, abs(capQ.y)));
          col += railCol * capBar * fog * 0.6;
          float head = exp(-length(capQ * vec2(40.0, 6.0)) * 1.5);
          col += railCol * head * fog * 0.9;
        }
      }
    }
    {
      float travelLen = 8.5;
      float speed = 3.5 + h11(float(i)+5.0) * 0.5;
      for (int c = 0; c < 3; c++) {
        float fc = float(c);
        float phase = fc / 3.0 + h11(float(i)+19.7+fc*3.3) * 0.2;
        float zPos = 9.0 - mod(t * speed + phase * travelLen, travelLen);
        vec2 capQ = vec2(p.x - xPos, p.z - zPos);
        if (length(capQ) < 0.25) {
          float capBar = (1.0 - smoothstep(0.0, 0.015, abs(capQ.x))) * (1.0 - smoothstep(0.0, 0.18, abs(capQ.y)));
          col += railCol * capBar * fog * 0.6;
          float head = exp(-length(capQ * vec2(40.0, 6.0)) * 1.5);
          col += railCol * head * fog * 0.9;
        }
      }
    }
  }
  return col;
}

vec3 binaryGlyphs(vec3 ro, vec3 rd, float t){
  float planeZ = 9.0;
  if (rd.z < 0.001) return vec3(0.0);
  float depth = (planeZ - ro.z) / rd.z;
  if (depth < 0.1) return vec3(0.0);
  vec3 p = ro + rd * depth;
  float absX = abs(p.x);
  if (absX < 2.5 || absX > 6.5) return vec3(0.0);
  if (p.y < -0.3 || p.y > 3.5) return vec3(0.0);
  vec3 col = vec3(0.0);
  float fog = exp(-depth * 0.045);
  vec2 g = vec2(p.x, p.y) * 5.0;
  vec2 cell = floor(g);
  vec2 cf = fract(g) - 0.5;
  float vis = step(0.65, h21(cell + 31.7));
  if (vis < 0.5) return vec3(0.0);
  float bit = step(0.5, h21(cell + 51.3));
  float lifePhase = mod(t * 0.5 + h21(cell + 7.7) * 6.0, 6.0);
  float life = (lifePhase < 1.0) ? smoothstep(0.0, 1.0, lifePhase) :
               (lifePhase > 5.0) ? smoothstep(6.0, 5.0, lifePhase) : 1.0;
  vec3 glyphCol = vec3(0.0);
  if (bit < 0.5) {
    float r = length(cf);
    float ring = 1.0 - smoothstep(0.0, 0.012, abs(r - 0.10));
    glyphCol = CYAN_LIGHT * ring;
  } else {
    float vBar = step(abs(cf.x), 0.012) * step(abs(cf.y), 0.13);
    float capTop = step(abs(cf.x - (-0.05)), 0.04) * step(abs(cf.y - 0.10), 0.012);
    glyphCol = AURORA_PINK * (vBar + capTop);
  }
  col += glyphCol * life * fog * 0.45;
  return col;
}

vec3 spiralingSeals(vec3 ro, vec3 rd, float t){
  float planeZ = 9.0;
  if (rd.z < 0.001) return vec3(0.0);
  float depth = (planeZ - ro.z) / rd.z;
  if (depth < 0.1) return vec3(0.0);
  vec3 p = ro + rd * depth;
  vec2 q = p.xy - vec2(0.0, 1.30);
  vec3 col = vec3(0.0);
  float fog = exp(-depth * 0.045);
  for (int s = 0; s < 6; s++) {
    float fs = float(s);
    float baseAng = fs * (2.0 * PI / 6.0);
    float ang = baseAng + t * 0.08;
    float baseR = 3.5 + h11(fs) * 1.0;
    float r = baseR + sin(t * 0.15 + fs) * 0.25;
    vec2 sealC = vec2(cos(ang) * r, sin(ang) * r * 0.9);
    vec2 dq = q - sealC;
    float dist = length(dq);
    if (dist > 0.08) continue;
    vec2 sealAp = abs(dq);
    float armL = 0.030;
    float armW = 0.010;
    float hv = step(sealAp.x, armL) * step(sealAp.y, armW);
    float vv = step(sealAp.x, armW) * step(sealAp.y, armL);
    float cross = clamp(hv + vv, 0.0, 1.0);
    float ring = 1.0 - smoothstep(0.0, 0.004, abs(dist - 0.055));
    float pulse = 0.55 + 0.45 * sin(t * 0.4 + fs * 1.3);
    col += RED_LIGHT * cross * pulse * fog * 0.75;
    col += GOLD * ring * pulse * fog * 0.45;
  }
  return col;
}

vec3 emissionArcs(vec3 ro, vec3 rd, float t){
  float planeZ = 9.0;
  if (rd.z < 0.001) return vec3(0.0);
  float depth = (planeZ - ro.z) / rd.z;
  if (depth < 0.1) return vec3(0.0);
  vec3 p = ro + rd * depth;
  vec2 q = p.xy - vec2(0.0, 1.30);
  float distFromShield = length(q);
  if (distFromShield < 2.6 || distFromShield > 5.5) return vec3(0.0);
  vec3 col = vec3(0.0);
  float fog = exp(-depth * 0.045);
  for (int a = 0; a < 4; a++) {
    float fa = float(a);
    float period = 5.5 + fa * 0.7;
    float phase = mod(t + fa * 1.7, period);
    if (phase > 1.4) continue;
    float eventID = floor(t / period + fa * 0.3);
    float angShoot = h11(eventID + fa * 13.3) * 2.0 * PI;
    float radHead = 2.6 + phase * 2.1;
    float radTail = max(2.6, radHead - 1.5);
    float currAng = atan(q.y, q.x);
    float dAng = abs(currAng - angShoot);
    dAng = min(dAng, 2.0 * PI - dAng);
    float angTol = 0.04;
    if (dAng > angTol) continue;
    float headDist = abs(distFromShield - radHead);
    float head = exp(-headDist * headDist * 80.0);
    float tail = 0.0;
    if (distFromShield < radHead && distFromShield > radTail) {
      tail = smoothstep(radTail, radHead, distFromShield) * 0.4;
    }
    float fadeOut = smoothstep(1.4, 0.9, phase);
    vec3 arcCol;
    if (a == 0) arcCol = CYAN_LIGHT;
    else if (a == 1) arcCol = AURORA_PINK;
    else if (a == 2) arcCol = AURORA_VIOLET;
    else arcCol = RED_LIGHT;
    float angFalloff = exp(-dAng * dAng * 800.0);
    col += arcCol * (head + tail) * angFalloff * fadeOut * fog * 0.7;
  }
  return col;
}

vec2 shieldPoint(float s, float W, float H){
  bool mirror = s > 0.5;
  float u = mirror ? (1.0 - s) : s;
  vec2 p;
  if (u < 0.10) {
    float k = u / 0.10;
    p = vec2(k * W, H);
  } else {
    float v = (u - 0.10) / 0.40;
    float y = mix(H, -H * 1.10, v);
    float xCurve;
    if (v < 0.65) xCurve = W * cos(v * 1.30 * 0.5);
    else {
      float w = (v - 0.65) / 0.35;
      float xStart = W * cos(0.325);
      xCurve = xStart * (1.0 - smoothstep(0.0, 1.0, w));
    }
    p = vec2(xCurve, y);
  }
  if (mirror) p.x = -p.x;
  return p;
}

vec2 shieldDistAndArc(vec2 q, float W, float H){
  float minD = 1e9;
  float minS = 0.0;
  const int N = 48;
  vec2 prev = shieldPoint(0.0, W, H);
  for (int i = 1; i <= N; i++){
    float s = float(i) / float(N);
    vec2 curr = shieldPoint(s, W, H);
    vec2 ab = curr - prev;
    float L2 = dot(ab, ab);
    float tparam = clamp(dot(q - prev, ab) / max(L2, 1e-6), 0.0, 1.0);
    vec2 proj = prev + ab * tparam;
    float d = length(q - proj);
    if (d < minD){
      minD = d;
      minS = (float(i-1) + tparam) / float(N);
    }
    prev = curr;
  }
  return vec2(minD, minS);
}

/* SHIELD avec TOUS LES DETAILS : inner rings + cross + 4 traces + pads + cardinals + holo seal + serial */
vec3 shield3D(vec3 ro, vec3 rd, float t){
  float planeZ = 9.0;
  if (rd.z < 0.001) return vec3(0.0);
  float depth = (planeZ - ro.z) / rd.z;
  if (depth < 0.1) return vec3(0.0);
  vec3 p = ro + rd * depth;
  vec2 q = p.xy - vec2(0.0, 1.30);
  float rotY = sin(t * 0.08) * 0.18;
  float scaleX = cos(rotY);
  q.x /= max(scaleX, 0.3);
  float W = 2.20;
  float H = 2.90;
  if (abs(q.x) > W * 1.35 || q.y > H * 1.25 || q.y < -H * 1.40) return vec3(0.0);
  float fog = exp(-depth * 0.045);
  vec3 col = vec3(0.0);
  vec2 absQ = vec2(abs(q.x), q.y);
  bool roughlyInside = (absQ.x < W * 0.98) && (absQ.y < H * 1.02) && (absQ.y > -H * 1.12);
  
  /* Background guilloché interieur */
  if (roughlyInside) {
    col -= PCB_HI * 0.18 * fog;
    col += RED_SWISS * 0.08 * fog;
    float gp = sin(q.x * 18.0 + sin(q.y * 14.0) * 1.5);
    float gp2 = sin(q.y * 20.0 + sin(q.x * 16.0) * 1.5);
    float gComb = (gp + gp2) * 0.5;
    float gLines = smoothstep(0.65, 0.78, abs(gComb));
    col += RED_LIGHT * gLines * 0.07 * fog;
  }
  
  /* Contour principal */
  vec2 distArc = shieldDistAndArc(q, W, H);
  float distMain = distArc.x;
  float arcS = distArc.y;
  float wMain = 0.011;
  float aaMain = fwidth(distMain) * 1.5;
  float mainLine = 1.0 - smoothstep(wMain - aaMain, wMain + aaMain, distMain);
  col += INK * mainLine * 0.85 * fog;
  
  /* Glow autour du contour avec impulsions tournantes */
  if (distMain < 0.13) {
    float falloff = exp(-distMain * 35.0);
    float s1 = mod(t * 0.07, 1.0);
    float d1 = abs(arcS - s1); d1 = min(d1, 1.0 - d1);
    float imp1 = exp(-d1 * d1 * 700.0);
    float s2 = mod(0.33 - t * 0.11, 1.0);
    float d2 = abs(arcS - s2); d2 = min(d2, 1.0 - d2);
    float imp2 = exp(-d2 * d2 * 500.0);
    float s3 = mod(0.66 + t * 0.15, 1.0);
    float d3 = abs(arcS - s3); d3 = min(d3, 1.0 - d3);
    float imp3 = exp(-d3 * d3 * 1200.0);
    col += INK * imp1 * falloff * 0.55 * fog;
    col += AURORA_VIOLET * imp2 * falloff * 0.55 * fog;
    col += CYAN_LIGHT * imp3 * falloff * 0.80 * fog;
  }
  
  float breathe = 0.88 + 0.12 * sin(t * 0.55);
  col *= breathe;
  
  /* ANNEAU INNER 1 - argent */
  float innerOffset = (W + H) * 0.04;
  float distInner = abs(distMain - innerOffset);
  float wInner = 0.007;
  float aaInner = fwidth(distInner) * 1.5;
  if (roughlyInside) {
    float innerLine = 1.0 - smoothstep(wInner - aaInner, wInner + aaInner, distInner);
    col += INK_DIM * innerLine * 0.45 * breathe * fog;
  }
  
  /* ANNEAU INNER 2 - or */
  float innerOffset2 = (W + H) * 0.075;
  float distInner2 = abs(distMain - innerOffset2);
  float wInner2 = 0.004;
  float aaInner2 = fwidth(distInner2) * 1.5;
  if (roughlyInside) {
    float innerLine2 = 1.0 - smoothstep(wInner2 - aaInner2, wInner2 + aaInner2, distInner2);
    col += GOLD * innerLine2 * 0.35 * breathe * fog;
  }
  
  /* CROIX */
  float armLen = W * 0.38;
  float armW = W * 0.12;
  vec2 ap = abs(q);
  vec2 dHc = ap - vec2(armLen, armW);
  float sdH = max(dHc.x, dHc.y);
  vec2 dVc = ap - vec2(armW, armLen);
  float sdV = max(dVc.x, dVc.y);
  float sdCross = min(sdH, sdV);
  float wCross = 0.010;
  float aaCross = fwidth(sdCross) * 1.5;
  float crossLine = 1.0 - smoothstep(wCross - aaCross, wCross + aaCross, abs(sdCross));
  float crossInside = step(sdCross, 0.0);
  float crossGuilloche = 0.0;
  if (crossInside > 0.5) {
    float gx = sin(q.x * 35.0 + q.y * 12.0);
    float gy = sin(q.y * 35.0 + q.x * 12.0);
    crossGuilloche = smoothstep(0.55, 0.75, abs(gx * gy));
  }
  float crossBreathe = 0.6 + 0.4 * sin(t * 1.0);
  col += RED_SWISS * crossInside * 0.22 * fog;
  col += RED_LIGHT * crossGuilloche * 0.12 * fog;
  col += RED_LIGHT * crossLine * 0.85 * crossBreathe * fog;
  
  /* 4 TRACES depuis la croix vers les bords */
  {
    vec4 segs[4];
    segs[0] = vec4(0.0,  armLen,        0.0,  H * 0.94);
    segs[1] = vec4( armLen, 0.0,        W * 0.92, 0.0);
    segs[2] = vec4(0.0, -armLen,        0.0, -H * 0.82);
    segs[3] = vec4(-armLen, 0.0,       -W * 0.92, 0.0);
    for (int i = 0; i < 4; i++) {
      vec2 a = segs[i].xy;
      vec2 b = segs[i].zw;
      vec2 ab = b - a;
      float L = length(ab);
      vec2 dir = ab / L;
      vec2 perp = vec2(-dir.y, dir.x);
      float along = dot(q - a, dir);
      float across = abs(dot(q - a, perp));
      float inSeg = step(0.0, along) * step(along, L);
      float linkW = 0.008;
      float linkLine = (1.0 - smoothstep(linkW, linkW + 0.006, across)) * inSeg;
      col += RED_SWISS * linkLine * 0.55 * breathe * fog;
      float pulseSpeed = 0.20 + h11(float(i) + 7.0) * 0.10;
      float pulsePos = mod(t * pulseSpeed + h11(float(i)) * L, L);
      float pulseDist = length(vec2(along - pulsePos, across));
      float pulse = exp(-pulseDist * pulseDist * 200.0) * inSeg;
      col += RED_LIGHT * pulse * 0.95 * fog;
      
      /* PAD au bout de chaque trace */
      vec2 dEnd = q - b;
      float padR = length(dEnd);
      float pad = 1.0 - smoothstep(0.030, 0.040, padR);
      float padRing = lineAA(abs(padR - 0.040), 0.005);
      col += RED_SWISS * pad * 0.6 * fog;
      col += RED_LIGHT * padRing * breathe * 0.7 * fog;
    }
  }
  
  /* CORE central pulsant */
  {
    float coreR = length(q);
    float corePulse = 0.6 + 0.4 * sin(t * 0.8);
    float coreCore = 1.0 - smoothstep(0.0, 0.035, coreR);
    float coreHalo = exp(-coreR * 18.0) * 0.5;
    col += RED_LIGHT * coreCore * corePulse * 0.7 * fog;
    col += RED_SWISS * coreHalo * corePulse * fog;
  }
  
  /* TICKS sur l'anneau exterieur (graduations) */
  {
    float ringRange = step(0.014, distMain) * step(distMain, 0.024);
    float tickS = arcS * 80.0;
    float tickI = floor(tickS);
    float tickF = abs(fract(tickS) - 0.5) * 2.0;
    float visible = step(0.35, h21(vec2(tickI, 0.0)));
    float tickLine = (1.0 - smoothstep(0.75, 0.85, tickF)) * visible;
    col += INK_DIM * ringRange * tickLine * 0.55 * fog;
  }
  
  /* CARDINAUX - points boussole N/S/E/W */
  {
    vec2 cardinals[4];
    cardinals[0] = vec2(0.0,  H * 1.06);
    cardinals[1] = vec2(0.0, -H * 1.20);
    cardinals[2] = vec2(-W * 1.10, 0.0);
    cardinals[3] = vec2( W * 1.10, 0.0);
    for (int i = 0; i < 4; i++){
      vec2 dq = q - cardinals[i];
      float r = length(dq);
      if (r > 0.13) continue;
      float bh = step(abs(dq.x), 0.06) * step(abs(dq.y), 0.005);
      float bv = step(abs(dq.x), 0.005) * step(abs(dq.y), 0.06);
      float circ = 1.0 - smoothstep(0.0, 0.008, abs(r - 0.030));
      float cardPulse = 0.5 + 0.5 * sin(t * 0.55 + float(i) * PI * 0.5);
      col += INK * (bh + bv + circ * 0.6) * cardPulse * 0.55 * fog;
    }
  }
  
  /* SCEAU HOLOGRAPHIQUE en or (top-right) */
  {
    vec2 sealC = vec2(W * 0.62, H * 0.65);
    vec2 dq = q - sealC;
    float r = length(dq);
    if (r < 0.10) {
      float ang = atan(dq.y, dq.x);
      float holoPattern = sin(ang * 12.0 + t * 0.6 + r * 60.0);
      float holoShift = sin(t * 0.3) * 0.5 + 0.5;
      vec3 holoCol = mix(GOLD, CYAN_LIGHT, holoShift);
      float outlineH = 1.0 - smoothstep(0.0, 0.004, abs(r - 0.05));
      float shim = (1.0 - smoothstep(0.045, 0.05, r)) * smoothstep(0.0, 0.04, abs(holoPattern));
      col += holoCol * outlineH * 0.7 * fog;
      col += holoCol * shim * 0.25 * fog;
      vec2 sealAp = abs(dq);
      float miniArm = 0.018, miniW = 0.005;
      float miniH = step(sealAp.x, miniArm) * step(sealAp.y, miniW);
      float miniV = step(sealAp.x, miniW) * step(sealAp.y, miniArm);
      col += GOLD * (miniH + miniV) * 0.5 * fog;
    }
  }
  
  /* NUMERO DE SERIE en barre code en bas */
  {
    vec2 serialC = vec2(0.0, -H * 0.85);
    vec2 dq = q - serialC;
    if (abs(dq.x) < 0.30 && abs(dq.y) < 0.025) {
      float seg = floor((dq.x + 0.30) * 30.0);
      float segF = fract((dq.x + 0.30) * 30.0);
      float on = step(0.5, h21(vec2(seg, 1.0)));
      float tokenLen = 0.4 + h21(vec2(seg, 0.0)) * 0.4;
      float bar = step(segF, tokenLen) * on;
      float vEnv = 1.0 - smoothstep(0.0, 0.022, abs(dq.y));
      col += INK_DIM * bar * vEnv * 0.55 * fog;
    }
  }
  
  /* SWEEP scanner */
  if (distMain < 0.06) {
    float sweepCenter = mod(t * 0.04, 1.0);
    float dArc = abs(arcS - sweepCenter); dArc = min(dArc, 1.0 - dArc);
    float sweep = smoothstep(0.12, 0.0, dArc) * exp(-distMain * 50.0);
    col += CYAN_LIGHT * sweep * 0.30 * fog;
  }
  
  return col;
}

vec3 dust(vec3 ro, vec3 rd, float t){
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float marchT = 1.2 + fi * 1.4;
    vec3 p = ro + rd * marchT;
    if (p.y < 0.2) continue;
    if (marchT > 20.0) continue;
    vec3 cell = floor(vec3(p.x * 1.4, p.y * 1.4, p.z * 0.6));
    vec3 cf = fract(vec3(p.x * 1.4, p.y * 1.4, p.z * 0.6)) - 0.5;
    float keep = step(0.90, h21(cell.xy + cell.z * 5.7));
    if (keep < 0.5) continue;
    vec3 jitter = vec3(h21(cell.xy + 1.0), h21(cell.xy + 2.0), h21(cell.xy + 3.0)) - 0.5;
    jitter.y += sin(t * 0.2 + h21(cell.xy) * 6.28) * 0.10;
    float r = length(cf - jitter * 0.6) / 0.6;
    float pulse = 0.5 + 0.5 * sin(t * 0.8 + h21(cell.xy) * 6.28);
    float pt = exp(-r * r * 200.0) * pulse;
    float fog = exp(-marchT * 0.06);
    float colorPick = h21(cell.xy + 41.0);
    vec3 dustCol;
    if (colorPick > 0.94)      dustCol = RED_LIGHT;
    else if (colorPick > 0.80) dustCol = AURORA_PINK;
    else if (colorPick > 0.55) dustCol = CYAN_LIGHT;
    else                       dustCol = INK_DIM;
    acc += dustCol * pt * fog * 0.45;
  }
  return acc;
}

vec3 globalScan(vec2 uv, float t){
  float y = 1.0 - mod(t * 0.035, 1.2);
  float d = abs(uv.y - y);
  float line = 1.0 - smoothstep(0.0, 0.0008, d);
  float halo = exp(-d * 40.0) * 0.10;
  return CYAN_LIGHT * (line * 0.25 + halo) * 0.30;
}

void main(){
  vec2 uv = v_uv;
  Cam cam = buildCam(u_mouse, u_time);
  vec3 ro = cam.pos;
  vec3 rd = rayDir(cam, uv);
  vec3 col = auroraSky(rd, uv, u_time);
  col += skyPerspectiveGrid(ro, rd, u_time);
  col += floorWideGrid(ro, rd, u_time);
  col += perspectiveGrid(ro, rd, u_time);
  col += depthBeams(ro, rd, u_time);
  col += emissionArcs(ro, rd, u_time);
  col += binaryGlyphs(ro, rd, u_time);
  col += shield3D(ro, rd, u_time);
  col += lateralBeams(ro, rd, u_time);
  col += spiralingSeals(ro, rd, u_time);
  col += dust(ro, rd, u_time);
  col += globalScan(uv, u_time);
  float grain = (h21(uv * u_res + u_time * 40.0) - 0.5) * 0.020;
  col += grain;
  col = clamp(col, vec3(0.0), vec3(1.0));
  outColor = vec4(col, 1.0);
}
`;

    function compile(type: number, src: string) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) {
        console.error(gl!.getShaderInfoLog(s));
        return null;
      }
      return s;
    }

    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(prog));
      return;
    }

    gl.useProgram(prog);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uMouse = gl.getUniformLocation(prog, "u_mouse");
    const uMouseAct = gl.getUniformLocation(prog, "u_mouseAct");

    const MAX_DPR = 1.4;
    function resize() {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl!.viewport(0, 0, w, h);
      }
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener("resize", resize);

    const mouse = { x: 0.5, y: 0.5, activity: 0 };
    let lastMove = 0;
    let smX = 0.5;
    let smY = 0.5;

    const onPointerMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
      mouse.y = Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1);
      mouse.activity = 1;
      lastMove = performance.now();
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const start = performance.now();
    let rafId = 0;
    function frame(now: number) {
      rafId = requestAnimationFrame(frame);
      const t = (now - start) / 1000;
      const sinceMove = now - lastMove;
      mouse.activity = Math.max(0, 1 - sinceMove / 1400);
      // EASING PLUS RAPIDE : 0.035 -> 0.08 (mouvement plus reactif)
      smX += (mouse.x - smX) * 0.08;
      smY += (mouse.y - smY) * 0.08;
      gl!.uniform2f(uRes, canvas!.width, canvas!.height);
      gl!.uniform1f(uTime, t);
      gl!.uniform2f(uMouse, smX, smY);
      gl!.uniform1f(uMouseAct, mouse.activity);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    }
    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", resize);
      ro.disconnect();
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
      gl.deleteVertexArray(vao);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ background: "#050818" }}
    />
  );
}