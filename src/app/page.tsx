"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

// Game constants
const PLAYER_HEIGHT = 1.7;
const PLAYER_SPEED = 5;
const MOUSE_SENSITIVITY = 0.002;
const GRAVITY = 20;
const JUMP_FORCE = 8;

interface Enemy {
  mesh: THREE.Group;
  health: number;
  velocity: THREE.Vector3;
  lastShot: number;
  shootCooldown: number;
}

interface Bullet {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
}

export default function Game() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [health, setHealth] = useState(100);
  const [ammo, setAmmo] = useState(30);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 10, 100);

    // Camera (first person)
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, PLAYER_HEIGHT, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    scene.add(directionalLight);

    // Ground
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x3d5c3d,
      roughness: 0.8,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Create walls and obstacles
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.7,
    });

    const obstacles: THREE.Mesh[] = [];

    // Outer walls
    const createWall = (
      x: number,
      z: number,
      width: number,
      height: number,
      depth: number
    ) => {
      const geometry = new THREE.BoxGeometry(width, height, depth);
      const wall = new THREE.Mesh(geometry, wallMaterial);
      wall.position.set(x, height / 2, z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      scene.add(wall);
      obstacles.push(wall);
      return wall;
    };

    // Perimeter walls
    createWall(0, -50, 200, 10, 2);
    createWall(0, 50, 200, 10, 2);
    createWall(-50, 0, 2, 10, 100);
    createWall(50, 0, 2, 10, 100);

    // Interior obstacles (boxes and cover)
    const boxMaterial = new THREE.MeshStandardMaterial({
      color: 0x666666,
      roughness: 0.5,
    });

    const createBox = (x: number, z: number, size: number) => {
      const geometry = new THREE.BoxGeometry(size, size, size);
      const box = new THREE.Mesh(geometry, boxMaterial);
      box.position.set(x, size / 2, z);
      box.castShadow = true;
      box.receiveShadow = true;
      scene.add(box);
      obstacles.push(box);
      return box;
    };

    // Create cover boxes
    createBox(10, 10, 3);
    createBox(-15, 5, 2);
    createBox(20, -20, 4);
    createBox(-25, -15, 3);
    createBox(5, -30, 2);
    createBox(-10, 25, 3);
    createBox(30, 15, 2);
    createBox(-35, 10, 4);
    createBox(15, 35, 3);
    createBox(-20, -35, 2);

    // Enemies
    const enemies: Enemy[] = [];
    const enemyBullets: Bullet[] = [];
    
    // Quake-style enemy materials
    const enemyBodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b0000,
      roughness: 0.6,
      metalness: 0.2,
    });
    const enemyArmorMaterial = new THREE.MeshStandardMaterial({
      color: 0x2f2f2f,
      roughness: 0.4,
      metalness: 0.7,
    });
    const enemySkinMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b6914,
      roughness: 0.8,
    });
    const enemyWeaponMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.3,
      metalness: 0.9,
    });
    const enemyGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4400,
    });

    const createEnemy = (x: number, z: number) => {
      const group = new THREE.Group();
      
      // Legs
      const legGeometry = new THREE.CylinderGeometry(0.12, 0.15, 0.8, 8);
      const leftLeg = new THREE.Mesh(legGeometry, enemyArmorMaterial);
      leftLeg.position.set(-0.2, 0.4, 0);
      leftLeg.castShadow = true;
      group.add(leftLeg);
      
      const rightLeg = new THREE.Mesh(legGeometry, enemyArmorMaterial);
      rightLeg.position.set(0.2, 0.4, 0);
      rightLeg.castShadow = true;
      group.add(rightLeg);
      
      // Feet
      const footGeometry = new THREE.BoxGeometry(0.2, 0.1, 0.3);
      const leftFoot = new THREE.Mesh(footGeometry, enemyArmorMaterial);
      leftFoot.position.set(-0.2, 0.05, 0.05);
      leftFoot.castShadow = true;
      group.add(leftFoot);
      
      const rightFoot = new THREE.Mesh(footGeometry, enemyArmorMaterial);
      rightFoot.position.set(0.2, 0.05, 0.05);
      rightFoot.castShadow = true;
      group.add(rightFoot);
      
      // Torso
      const torsoGeometry = new THREE.BoxGeometry(0.6, 0.7, 0.4);
      const torso = new THREE.Mesh(torsoGeometry, enemyBodyMaterial);
      torso.position.set(0, 1.15, 0);
      torso.castShadow = true;
      group.add(torso);
      
      // Chest armor plate
      const chestPlateGeometry = new THREE.BoxGeometry(0.5, 0.4, 0.1);
      const chestPlate = new THREE.Mesh(chestPlateGeometry, enemyArmorMaterial);
      chestPlate.position.set(0, 1.2, 0.2);
      chestPlate.castShadow = true;
      group.add(chestPlate);
      
      // Shoulder pads
      const shoulderGeometry = new THREE.SphereGeometry(0.18, 8, 8);
      const leftShoulder = new THREE.Mesh(shoulderGeometry, enemyArmorMaterial);
      leftShoulder.position.set(-0.4, 1.35, 0);
      leftShoulder.castShadow = true;
      group.add(leftShoulder);
      
      const rightShoulder = new THREE.Mesh(shoulderGeometry, enemyArmorMaterial);
      rightShoulder.position.set(0.4, 1.35, 0);
      rightShoulder.castShadow = true;
      group.add(rightShoulder);
      
      // Arms
      const armGeometry = new THREE.CylinderGeometry(0.08, 0.1, 0.5, 8);
      const leftArm = new THREE.Mesh(armGeometry, enemyBodyMaterial);
      leftArm.position.set(-0.4, 1.0, 0);
      leftArm.castShadow = true;
      group.add(leftArm);
      
      const rightArm = new THREE.Mesh(armGeometry, enemyBodyMaterial);
      rightArm.position.set(0.4, 1.0, 0);
      rightArm.rotation.x = -Math.PI / 4;
      rightArm.position.z = 0.15;
      rightArm.castShadow = true;
      group.add(rightArm);
      
      // Hands
      const handGeometry = new THREE.SphereGeometry(0.08, 8, 8);
      const leftHand = new THREE.Mesh(handGeometry, enemySkinMaterial);
      leftHand.position.set(-0.4, 0.75, 0);
      group.add(leftHand);
      
      const rightHand = new THREE.Mesh(handGeometry, enemySkinMaterial);
      rightHand.position.set(0.45, 0.85, 0.25);
      group.add(rightHand);
      
      // Head
      const headGeometry = new THREE.BoxGeometry(0.35, 0.4, 0.35);
      const head = new THREE.Mesh(headGeometry, enemySkinMaterial);
      head.position.set(0, 1.65, 0);
      head.castShadow = true;
      group.add(head);
      
      // Helmet
      const helmetGeometry = new THREE.SphereGeometry(0.25, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const helmet = new THREE.Mesh(helmetGeometry, enemyArmorMaterial);
      helmet.position.set(0, 1.7, 0);
      helmet.castShadow = true;
      group.add(helmet);
      
      // Visor (glowing eyes)
      const visorGeometry = new THREE.BoxGeometry(0.25, 0.08, 0.1);
      const visor = new THREE.Mesh(visorGeometry, enemyGlowMaterial);
      visor.position.set(0, 1.65, 0.18);
      group.add(visor);
      
      // Weapon (plasma rifle)
      const weaponGroup = new THREE.Group();
      
      // Main body of the gun
      const gunBodyGeometry = new THREE.BoxGeometry(0.12, 0.15, 0.6);
      const gunBody = new THREE.Mesh(gunBodyGeometry, enemyWeaponMaterial);
      gunBody.castShadow = true;
      weaponGroup.add(gunBody);
      
      // Barrel
      const barrelGeometry = new THREE.CylinderGeometry(0.04, 0.05, 0.3, 8);
      const barrel = new THREE.Mesh(barrelGeometry, enemyWeaponMaterial);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0, -0.45);
      barrel.castShadow = true;
      weaponGroup.add(barrel);
      
      // Barrel glow
      const barrelGlowGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8);
      const barrelGlow = new THREE.Mesh(barrelGlowGeometry, enemyGlowMaterial);
      barrelGlow.rotation.x = Math.PI / 2;
      barrelGlow.position.set(0, 0, -0.62);
      weaponGroup.add(barrelGlow);
      
      // Stock
      const stockGeometry = new THREE.BoxGeometry(0.08, 0.12, 0.2);
      const stock = new THREE.Mesh(stockGeometry, enemyWeaponMaterial);
      stock.position.set(0, -0.02, 0.35);
      stock.castShadow = true;
      weaponGroup.add(stock);
      
      // Position weapon in right hand
      weaponGroup.position.set(0.45, 0.8, 0.35);
      weaponGroup.rotation.y = Math.PI;
      group.add(weaponGroup);
      
      // Position the whole enemy
      group.position.set(x, 0, z);
      scene.add(group);
      
      enemies.push({
        mesh: group,
        health: 100,
        velocity: new THREE.Vector3(),
        lastShot: 0,
        shootCooldown: 1.5 + Math.random() * 1, // 1.5-2.5 seconds between shots
      });
    };

    // Spawn initial enemies
    createEnemy(20, 20);
    createEnemy(-20, 20);
    createEnemy(20, -20);
    createEnemy(-20, -20);
    createEnemy(0, 30);
    createEnemy(-30, 0);
    createEnemy(30, 0);

    // Bullets
    const bullets: Bullet[] = [];
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });

    // Weapon (simple box attached to camera)
    const weaponGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.5);
    const weaponMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.8,
      roughness: 0.2,
    });
    const weapon = new THREE.Mesh(weaponGeometry, weaponMaterial);
    weapon.position.set(0.3, -0.2, -0.5);
    camera.add(weapon);
    scene.add(camera);

    // Player state
    const playerVelocity = new THREE.Vector3();
    const playerDirection = new THREE.Vector3();
    let canJump = true;
    let currentAmmo = 30;
    let currentHealth = 100;
    let currentScore = 0;
    let isGameOver = false;

    // Input state
    const keys: { [key: string]: boolean } = {};
    let yaw = 0;
    let pitch = 0;

    // Pointer lock
    const onClick = () => {
      container?.requestPointerLock();
    };

    const onPointerLockChange = () => {
      setIsLocked(document.pointerLockElement === container);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== container) return;

      yaw -= e.movementX * MOUSE_SENSITIVITY;
      pitch -= e.movementY * MOUSE_SENSITIVITY;
      pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));
    };

    const onMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== container) return;
      if (e.button !== 0) return;
      if (currentAmmo <= 0) return;
      if (isGameOver) return;

      currentAmmo--;
      setAmmo(currentAmmo);

      // Create bullet
      const bulletGeometry = new THREE.SphereGeometry(0.05);
      const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

      // Get camera direction
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);

      bullet.position.copy(camera.position);
      bullet.position.add(direction.clone().multiplyScalar(1));

      scene.add(bullet);
      bullets.push({
        mesh: bullet,
        velocity: direction.multiplyScalar(50),
        life: 2,
      });

      // Weapon recoil animation
      weapon.position.z = -0.3;
      setTimeout(() => {
        weapon.position.z = -0.5;
      }, 50);
    };

    // Event listeners
    container.addEventListener("click", onClick);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mousedown", onMouseDown);

    // Handle resize
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    // Collision detection
    const checkCollision = (
      position: THREE.Vector3,
      radius: number = 0.5
    ): boolean => {
      for (const obstacle of obstacles) {
        const box = new THREE.Box3().setFromObject(obstacle);
        const sphere = new THREE.Sphere(position, radius);
        if (box.intersectsSphere(sphere)) {
          return true;
        }
      }
      return false;
    };

    // Game loop
    const clock = new THREE.Clock();
    let animationId: number;

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      if (isGameOver) {
        renderer.render(scene, camera);
        return;
      }

      const delta = Math.min(clock.getDelta(), 0.1);

      // Update camera rotation
      camera.rotation.order = "YXZ";
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;

      // Player movement
      playerDirection.set(0, 0, 0);

      if (keys["KeyW"]) playerDirection.z -= 1;
      if (keys["KeyS"]) playerDirection.z += 1;
      if (keys["KeyA"]) playerDirection.x -= 1;
      if (keys["KeyD"]) playerDirection.x += 1;

      if (playerDirection.length() > 0) {
        playerDirection.normalize();

        // Rotate direction based on camera yaw
        const moveDirection = playerDirection.clone();
        moveDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

        const newPosition = camera.position.clone();
        newPosition.x += moveDirection.x * PLAYER_SPEED * delta;
        newPosition.z += moveDirection.z * PLAYER_SPEED * delta;

        // Check collision for X movement
        const testPosX = camera.position.clone();
        testPosX.x = newPosition.x;
        if (!checkCollision(testPosX)) {
          camera.position.x = newPosition.x;
        }

        // Check collision for Z movement
        const testPosZ = camera.position.clone();
        testPosZ.z = newPosition.z;
        if (!checkCollision(testPosZ)) {
          camera.position.z = newPosition.z;
        }
      }

      // Jump and gravity
      if (keys["Space"] && canJump) {
        playerVelocity.y = JUMP_FORCE;
        canJump = false;
      }

      playerVelocity.y -= GRAVITY * delta;
      camera.position.y += playerVelocity.y * delta;

      // Ground collision
      if (camera.position.y < PLAYER_HEIGHT) {
        camera.position.y = PLAYER_HEIGHT;
        playerVelocity.y = 0;
        canJump = true;
      }

      // Boundary check
      camera.position.x = Math.max(-48, Math.min(48, camera.position.x));
      camera.position.z = Math.max(-48, Math.min(48, camera.position.z));

      // Update bullets
      for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.mesh.position.add(
          bullet.velocity.clone().multiplyScalar(delta)
        );
        bullet.life -= delta;

        // Check enemy collision
        for (let j = enemies.length - 1; j >= 0; j--) {
          const enemy = enemies[j];
          const enemyPos = enemy.mesh.position.clone();
          enemyPos.y += 1; // Center of enemy body
          const distance = bullet.mesh.position.distanceTo(enemyPos);
          if (distance < 1.2) {
            enemy.health -= 34;
            scene.remove(bullet.mesh);
            bullets.splice(i, 1);

            if (enemy.health <= 0) {
              scene.remove(enemy.mesh);
              enemies.splice(j, 1);
              currentScore += 100;
              setScore(currentScore);

              // Spawn new enemy
              const angle = Math.random() * Math.PI * 2;
              const spawnDist = 30 + Math.random() * 15;
              createEnemy(
                Math.cos(angle) * spawnDist,
                Math.sin(angle) * spawnDist
              );
            }
            break;
          }
        }

        // Remove old bullets
        if (bullet.life <= 0) {
          scene.remove(bullet.mesh);
          bullets.splice(i, 1);
        }
      }

      // Update enemies
      const currentTime = clock.getElapsedTime();
      
      for (const enemy of enemies) {
        // Move towards player
        const direction = new THREE.Vector3();
        direction.subVectors(camera.position, enemy.mesh.position);
        direction.y = 0;
        direction.normalize();

        const distanceToPlayer = enemy.mesh.position.distanceTo(camera.position);
        
        // Move if not too close
        if (distanceToPlayer > 8) {
          const enemySpeed = 2.5;
          const newEnemyPos = enemy.mesh.position.clone();
          newEnemyPos.add(direction.clone().multiplyScalar(enemySpeed * delta));

          // Simple collision check for enemies
          let canMove = true;
          for (const obstacle of obstacles) {
            const box = new THREE.Box3().setFromObject(obstacle);
            if (box.containsPoint(newEnemyPos)) {
              canMove = false;
              break;
            }
          }

          if (canMove) {
            enemy.mesh.position.copy(newEnemyPos);
          }
        }

        // Look at player
        enemy.mesh.lookAt(
          camera.position.x,
          enemy.mesh.position.y,
          camera.position.z
        );

        // Shoot at player
        if (distanceToPlayer < 30 && currentTime - enemy.lastShot > enemy.shootCooldown) {
          enemy.lastShot = currentTime;
          
          // Create enemy bullet
          const bulletGeometry = new THREE.SphereGeometry(0.1);
          const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff4400 });
          const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
          
          // Shoot from enemy weapon position
          const weaponPos = new THREE.Vector3(0.45, 0.8, -0.3);
          weaponPos.applyQuaternion(enemy.mesh.quaternion);
          bullet.position.copy(enemy.mesh.position).add(weaponPos);
          
          // Direction towards player with slight inaccuracy
          const shootDir = direction.clone();
          shootDir.y = (camera.position.y - bullet.position.y) / distanceToPlayer;
          shootDir.normalize();
          
          // Add slight random spread
          shootDir.x += (Math.random() - 0.5) * 0.1;
          shootDir.y += (Math.random() - 0.5) * 0.1;
          shootDir.z += (Math.random() - 0.5) * 0.1;
          shootDir.normalize();
          
          scene.add(bullet);
          enemyBullets.push({
            mesh: bullet,
            velocity: shootDir.multiplyScalar(25),
            life: 3,
          });
        }

        // Melee attack if very close
        if (distanceToPlayer < 2) {
          currentHealth -= 10 * delta;
          setHealth(Math.max(0, Math.round(currentHealth)));

          if (currentHealth <= 0) {
            isGameOver = true;
            setGameOver(true);
          }
        }
      }
      
      // Update enemy bullets
      for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
        bullet.mesh.position.add(bullet.velocity.clone().multiplyScalar(delta));
        bullet.life -= delta;
        
        // Check player collision
        const distanceToPlayer = bullet.mesh.position.distanceTo(camera.position);
        if (distanceToPlayer < 0.5) {
          currentHealth -= 15;
          setHealth(Math.max(0, Math.round(currentHealth)));
          scene.remove(bullet.mesh);
          enemyBullets.splice(i, 1);
          
          if (currentHealth <= 0) {
            isGameOver = true;
            setGameOver(true);
          }
          continue;
        }
        
        // Remove old bullets
        if (bullet.life <= 0) {
          scene.remove(bullet.mesh);
          enemyBullets.splice(i, 1);
        }
      }

      // Reload
      if (keys["KeyR"] && currentAmmo < 30) {
        setTimeout(() => {
          currentAmmo = 30;
          setAmmo(30);
        }, 1500);
      }

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      container?.removeEventListener("click", onClick);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("resize", onResize);
      container?.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-crosshair" />

      {/* HUD */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Crosshair */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="w-1 h-6 bg-white opacity-80 absolute left-1/2 transform -translate-x-1/2" />
          <div className="w-6 h-1 bg-white opacity-80 absolute top-1/2 transform -translate-y-1/2" />
        </div>

        {/* Health bar */}
        <div className="absolute bottom-8 left-8">
          <div className="text-white text-lg font-bold mb-2">
            ❤️ {health}%
          </div>
          <div className="w-48 h-4 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300"
              style={{ width: `${health}%` }}
            />
          </div>
        </div>

        {/* Ammo */}
        <div className="absolute bottom-8 right-8 text-right">
          <div className="text-white text-4xl font-bold">
            🔫 {ammo} / 30
          </div>
          <div className="text-gray-400 text-sm mt-1">Press R to reload</div>
        </div>

        {/* Score */}
        <div className="absolute top-8 right-8">
          <div className="text-white text-2xl font-bold">
            Score: {score}
          </div>
          <div className="text-gray-400 text-sm">Enemies killed: {Math.floor(score / 100)}</div>
        </div>

        {/* Instructions */}
        {!isLocked && !gameOver && (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-black/50 cursor-pointer"
            onClick={() => containerRef.current?.requestPointerLock()}
          >
            <div className="text-center text-white pointer-events-none">
              <h1 className="text-5xl font-bold mb-4">🎯 3D SHOOTER</h1>
              <p className="text-xl mb-8">Click to start</p>
              <div className="text-lg space-y-2">
                <p>WASD - Move</p>
                <p>Mouse - Look around</p>
                <p>Left Click - Shoot</p>
                <p>Space - Jump</p>
                <p>R - Reload</p>
              </div>
            </div>
          </div>
        )}

        {/* Game Over */}
        {gameOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 pointer-events-auto">
            <div className="text-center text-white">
              <h1 className="text-6xl font-bold mb-4 text-red-500">GAME OVER</h1>
              <p className="text-3xl mb-8">Final Score: {score}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-8 py-4 bg-red-600 hover:bg-red-700 rounded-lg text-xl font-bold transition-colors pointer-events-auto"
              >
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
