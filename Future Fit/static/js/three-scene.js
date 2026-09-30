/**
 * FutureFit - Interactive 3D Athletic Biomechanics Scene
 * Built with Three.js for the Interactive 3D Login Page
 */

class AthleticBiomechanicsScene {
  constructor(canvasContainerId) {
    this.container = document.getElementById(canvasContainerId);
    if (!this.container) return;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.particles = null;
    this.figureGroup = null;
    this.ringsGroup = null;
    this.mouseX = 0;
    this.mouseY = 0;
    this.targetMouseX = 0;
    this.targetMouseY = 0;
    this.clock = null;

    this.init();
  }

  init() {
    if (typeof THREE === 'undefined') {
      console.warn('Three.js not loaded yet');
      return;
    }

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x090d16, 0.0018);

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    this.camera.position.set(0, 5, 28);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const cyanPointLight = new THREE.PointLight(0x00f0ff, 3.5, 60);
    cyanPointLight.position.set(10, 15, 12);
    this.scene.add(cyanPointLight);

    const purplePointLight = new THREE.PointLight(0x8b5cf6, 3, 50);
    purplePointLight.position.set(-15, -10, 10);
    this.scene.add(purplePointLight);

    const limePointLight = new THREE.PointLight(0x10b981, 2.5, 45);
    limePointLight.position.set(0, -12, 15);
    this.scene.add(limePointLight);

    // Build Athletic Biomechanical Elements
    this.createAthleticWireframeFigure();
    this.createKineticOrbitRings();
    this.createParticleField();

    // Mouse Interaction
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('resize', () => this.onWindowResize());

    // Start animation loop
    this.animate();
  }

  createAthleticWireframeFigure() {
    this.figureGroup = new THREE.Group();

    // Skeletal Key Joint Nodes (Head, Shoulders, Spine, Hips, Knees, Ankles #27/#28)
    const joints = [
      { name: 'head', pos: [0, 12, 0], r: 1.4, color: 0x00f0ff },
      { name: 'neck', pos: [0, 9.8, 0], r: 0.5, color: 0x8b5cf6 },
      { name: 'chest', pos: [0, 7.5, 0.3], r: 0.9, color: 0x00f0ff },
      { name: 'spine', pos: [0, 5.0, 0], r: 0.7, color: 0x00f0ff },
      { name: 'pelvis', pos: [0, 2.8, 0], r: 1.1, color: 0x10b981 },
      // Left arm
      { name: 'left_shoulder', pos: [-3.2, 8.8, 0], r: 0.6, color: 0x8b5cf6 },
      { name: 'left_elbow', pos: [-4.8, 5.2, 0.8], r: 0.5, color: 0x8b5cf6 },
      { name: 'left_wrist', pos: [-5.6, 2.1, 1.8], r: 0.4, color: 0x00f0ff },
      // Right arm (cocked back for vertical jump drive)
      { name: 'right_shoulder', pos: [3.2, 8.8, 0], r: 0.6, color: 0x8b5cf6 },
      { name: 'right_elbow', pos: [4.6, 6.2, -1.2], r: 0.5, color: 0x8b5cf6 },
      { name: 'right_wrist', pos: [5.2, 3.8, -2.2], r: 0.4, color: 0x00f0ff },
      // Left leg (in spring takeoff crouch)
      { name: 'left_hip', pos: [-1.8, 2.2, 0], r: 0.7, color: 0x10b981 },
      { name: 'left_knee', pos: [-2.4, -2.5, 2.2], r: 0.65, color: 0x10b981 },
      { name: 'left_ankle', pos: [-2.1, -7.5, 0.2], r: 0.85, color: 0xf59e0b }, // Landmark #27 Highlight
      // Right leg
      { name: 'right_hip', pos: [1.8, 2.2, 0], r: 0.7, color: 0x10b981 },
      { name: 'right_knee', pos: [2.5, -3.0, 1.8], r: 0.65, color: 0x10b981 },
      { name: 'right_ankle', pos: [2.2, -7.8, -0.2], r: 0.8, color: 0x10b981 }
    ];

    const jointGeo = new THREE.IcosahedronGeometry(1, 2);

    joints.forEach((j) => {
      const mat = new THREE.MeshStandardMaterial({
        color: j.color,
        roughness: 0.2,
        metalness: 0.8,
        emissive: j.color,
        emissiveIntensity: j.name === 'left_ankle' ? 0.9 : 0.4,
        wireframe: false
      });
      const mesh = new THREE.Mesh(jointGeo, mat);
      mesh.scale.setScalar(j.r);
      mesh.position.set(j.pos[0], j.pos[1], j.pos[2]);
      this.figureGroup.add(mesh);

      // Add extra pulsating halo for Landmark #27 (Left Ankle)
      if (j.name === 'left_ankle') {
        const ringGeo = new THREE.TorusGeometry(1.6, 0.1, 16, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, wireframe: true });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.set(j.pos[0], j.pos[1], j.pos[2]);
        ringMesh.rotation.x = Math.PI / 2;
        this.leftAnkleRing = ringMesh;
        this.figureGroup.add(ringMesh);
      }
    });

    // Bone links connecting the landmarks
    const bones = [
      ['head', 'neck'],
      ['neck', 'chest'],
      ['chest', 'spine'],
      ['spine', 'pelvis'],
      ['neck', 'left_shoulder'],
      ['left_shoulder', 'left_elbow'],
      ['left_elbow', 'left_wrist'],
      ['neck', 'right_shoulder'],
      ['right_shoulder', 'right_elbow'],
      ['right_elbow', 'right_wrist'],
      ['pelvis', 'left_hip'],
      ['left_hip', 'left_knee'],
      ['left_knee', 'left_ankle'],
      ['pelvis', 'right_hip'],
      ['right_hip', 'right_knee'],
      ['right_knee', 'right_ankle']
    ];

    const boneMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.75,
      linewidth: 2
    });

    bones.forEach(([fromName, toName]) => {
      const fromJ = joints.find((j) => j.name === fromName);
      const toJ = joints.find((j) => j.name === toName);
      if (fromJ && toJ) {
        const points = [
          new THREE.Vector3(...fromJ.pos),
          new THREE.Vector3(...toJ.pos)
        ];
        const geom = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geom, boneMat);
        this.figureGroup.add(line);
      }
    });

    // Wireframe dynamic torso diamond
    const torsoGeo = new THREE.OctahedronGeometry(4.5, 1);
    const torsoMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
      emissive: 0x004488,
      emissiveIntensity: 0.2
    });
    const torsoMesh = new THREE.Mesh(torsoGeo, torsoMat);
    torsoMesh.position.set(0, 6, 0);
    torsoMesh.scale.set(1.2, 1.8, 0.9);
    this.figureGroup.add(torsoMesh);

    this.scene.add(this.figureGroup);
  }

  createKineticOrbitRings() {
    this.ringsGroup = new THREE.Group();

    // 3 Orbiting athletic energy rings
    const ringRadii = [14, 18, 22];
    const ringColors = [0x00f0ff, 0x8b5cf6, 0x10b981];

    ringRadii.forEach((rad, i) => {
      const geom = new THREE.TorusGeometry(rad, 0.08, 16, 120);
      const mat = new THREE.MeshBasicMaterial({
        color: ringColors[i],
        transparent: true,
        opacity: 0.45,
        wireframe: true
      });
      const ring = new THREE.Mesh(geom, mat);
      ring.rotation.x = (Math.PI / 4) * (i + 1);
      ring.rotation.y = (Math.PI / 6) * i;
      this.ringsGroup.add(ring);
    });

    this.scene.add(this.ringsGroup);
  }

  createParticleField() {
    const particleCount = 1400;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const palette = [
      new THREE.Color(0x00f0ff), // Cyan
      new THREE.Color(0x10b981), // Lime
      new THREE.Color(0x8b5cf6), // Purple
      new THREE.Color(0xffffff)  // Sparkle white
    ];

    for (let i = 0; i < particleCount; i++) {
      // Distribute in a spherical cloud around center
      const r = 10 + Math.random() * 35;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const color = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  onMouseMove(event) {
    const halfX = window.innerWidth / 2;
    const halfY = window.innerHeight / 2;
    this.targetMouseX = (event.clientX - halfX) / halfX;
    this.targetMouseY = (event.clientY - halfY) / halfY;
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();

    // Smooth camera mouse follow
    this.mouseX += (this.targetMouseX - this.mouseX) * 0.05;
    this.mouseY += (this.targetMouseY - this.mouseY) * 0.05;

    this.camera.position.x = this.mouseX * 6;
    this.camera.position.y = 5 - this.mouseY * 4;
    this.camera.lookAt(0, 3, 0);

    // Animate figure (dynamic breathing / vertical crouch oscillation)
    if (this.figureGroup) {
      this.figureGroup.rotation.y = Math.sin(elapsedTime * 0.4) * 0.25 + this.mouseX * 0.4;
      this.figureGroup.position.y = Math.sin(elapsedTime * 1.5) * 0.4;
    }

    // Animate Left Ankle #27 Ring pulse
    if (this.leftAnkleRing) {
      this.leftAnkleRing.rotation.z += 0.03;
      const s = 1.0 + Math.sin(elapsedTime * 6) * 0.25;
      this.leftAnkleRing.scale.set(s, s, s);
    }

    // Animate Orbit rings
    if (this.ringsGroup) {
      this.ringsGroup.children[0].rotation.z += 0.005;
      this.ringsGroup.children[1].rotation.x += 0.007;
      this.ringsGroup.children[2].rotation.y += 0.004;
    }

    // Rotate particles
    if (this.particles) {
      this.particles.rotation.y = elapsedTime * 0.03;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.AthleticBiomechanicsScene = AthleticBiomechanicsScene;
