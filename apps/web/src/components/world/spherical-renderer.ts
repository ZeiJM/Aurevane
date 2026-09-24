/** A single full-screen triangle pair renders the atlas or the inside of a panorama. */
export function createSphericalRenderer(
  canvas: HTMLCanvasElement,
  src: string,
  onFailure: () => void,
) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false })
  if (!gl) {
    onFailure()
    return null
  }
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader)
      throw new Error('Map shader failed')
    }
    return shader
  }
  let vertex: WebGLShader, fragment: WebGLShader
  try {
    vertex = compile(
      gl.VERTEX_SHADER,
      'attribute vec2 position;varying vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}',
    )
    fragment = compile(
      gl.FRAGMENT_SHADER,
      `precision highp float;
 varying vec2 uv; uniform sampler2D painting; uniform vec2 camera;uniform float zoom;uniform float panorama;uniform float grid;uniform float aspect;
 const float PI=3.14159265359;
 void main(){
  vec2 p=(uv*2.-1.); vec3 ray;
  if(panorama>.5){ray=normalize(vec3(p.x*aspect/zoom,p.y/zoom,1.));}
  else{
   vec2 globePoint=p;
   if(zoom<1.){globePoint=p/zoom;if(dot(globePoint,globePoint)>1.){gl_FragColor=vec4(0.);return;}}
   else{if(dot(p,p)>1.){gl_FragColor=vec4(0.);return;}globePoint=p/zoom;}
   ray=vec3(globePoint,sqrt(max(0.,1.-dot(globePoint,globePoint))));
  }
  float tilt=camera.y;vec3 turned=vec3(ray.x,ray.y*cos(tilt)+ray.z*sin(tilt),ray.z*cos(tilt)-ray.y*sin(tilt));
  float longitude=atan(turned.x,turned.z)+camera.x;float latitude=asin(clamp(turned.y,-1.,1.));
  vec2 map=vec2(fract(.5+longitude/(2.*PI)),.5-latitude/PI);
  vec3 color=texture2D(painting,map).rgb;
  if(panorama<.5){
   float lon=(map.x-.5)*360.;float lat=(.5-map.y)*180.;
   float fog=max(smoothstep(63.,88.,lon),max(1.-smoothstep(-106.,-78.,lon),smoothstep(69.,84.,abs(lat))));
   float cloud=sin(map.x*73.+sin(map.y*29.))*sin(map.y*97.+cos(map.x*41.));
   float grain=sin(map.x*189.+sin(map.y*31.))*sin(map.y*119.);
   float contour=.5+.5*sin((map.x*23.+map.y*17.+cloud*.18)*6.28318);
   vec3 veil=mix(vec3(.045,.105,.145),vec3(.12,.25,.29),.5+.28*cloud);
   veil+=vec3(.035,.055,.045)*(grain*.5+contour*.35);
   color=mix(color,veil,fog*.88);
   vec2 cell=fract(map*vec2(32.,16.));float edge=min(min(cell.x,1.-cell.x),min(cell.y,1.-cell.y));
   float line=(1.-smoothstep(.007,.021,edge))*grid*(.13+.87*(1.-fog))*.24;
   color=mix(color,vec3(.70,.82,.76),line);
   color*=.78+.22*ray.z;
   float rim=pow(1.-ray.z,4.);color=mix(color,vec3(.20,.65,.85),rim*.5);
  }
  gl_FragColor=vec4(color,1.);
 }`,
    )
  } catch {
    onFailure()
    return null
  }
  const program = gl.createProgram()!
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    onFailure()
    return null
  }
  const buffer = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  )
  gl.useProgram(program)
  const position = gl.getAttribLocation(program, 'position')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
  const texture = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  const uniforms = Object.fromEntries(
    ['camera', 'zoom', 'panorama', 'grid', 'aspect'].map((name) => [
      name,
      gl.getUniformLocation(program, name),
    ]),
  )
  let loaded = false,
    disposed = false,
    last = { longitude: 0, latitude: 0, zoom: 0.94, panorama: false, grid: true }
  function draw(view: typeof last) {
    last = view
    if (!loaded || disposed) return
    const ratio = Math.min(window.devicePixelRatio || 1, 2),
      width = Math.round(canvas.clientWidth * ratio),
      height = Math.round(canvas.clientHeight * ratio)
    if (!width || !height) return
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    gl!.viewport(0, 0, width, height)
    gl!.useProgram(program)
    gl!.uniform2f(
      uniforms.camera!,
      (view.longitude * Math.PI) / 180,
      (view.latitude * Math.PI) / 180,
    )
    gl!.uniform1f(uniforms.zoom!, view.zoom)
    gl!.uniform1f(uniforms.panorama!, view.panorama ? 1 : 0)
    gl!.uniform1f(uniforms.grid!, view.grid ? 1 : 0)
    gl!.uniform1f(uniforms.aspect!, width / height)
    gl!.drawArrays(gl!.TRIANGLES, 0, 6)
  }
  const art = new Image()
  art.onload = () => {
    if (disposed) return
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, art)
    loaded = true
    draw(last)
  }
  art.onerror = onFailure
  art.src = src
  const observer = new ResizeObserver(() => draw(last))
  observer.observe(canvas)
  const lost = (event: Event) => {
    event.preventDefault()
    onFailure()
  }
  canvas.addEventListener('webglcontextlost', lost)
  return {
    draw,
    dispose() {
      disposed = true
      observer.disconnect()
      art.onload = null
      art.onerror = null
      canvas.removeEventListener('webglcontextlost', lost)
      gl.deleteTexture(texture)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      gl.deleteShader(vertex)
      gl.deleteShader(fragment)
    },
  }
}
