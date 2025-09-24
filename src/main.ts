interface TrafficLight {
    x: number;
    currentState: 'red' | 'yellow' | 'green';
    timeInState: number;
    cycleTime: number;
}

interface Car {
    x: number;
    y: number;
    speed: number; // pixels per frame
    direction: 1 | -1; // 1 for eastbound, -1 for westbound
    color: string;
    hitRedLight: boolean;
}

class TrafficSimulation {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private lights: TrafficLight[] = [];
    private cars: Car[] = [];
    private animationId: number | null = null;
    private time: number = 0;
    private isRunning: boolean = false;

    // Configuration
    private speedLimit: number = 60; // mph
    private middleLightPosition: number = 35; // percentage from left
    private cycleTime: number = 30; // default cycle time in simulation seconds
    private lightOffsets: number[] = [0, 6, 12]; // green wave offsets: left=0s, middle=6s, right=12s
    private lightCycleTimes: number[] = [30, 30, 30]; // individual cycle times for each light in simulation seconds
    private lastCarSpawnTime: number = 0; // track when last cars were spawned
    private readonly CAR_SPAWN_INTERVAL = 3 * 60; // 3 seconds in frames (60 FPS)
    // Make total canvas width represent ~3 miles (15,840 feet)
    // Canvas is 1000px, minus 300px margins = 700px for road
    // 700px should represent ~3 miles = 15,840 feet
    private readonly PIXELS_PER_FOOT = 700 / 15840; // ~0.044 pixels per foot
    private readonly FPS = 60;
    private readonly ROAD_MARGIN = 150; // pixels from edge to first/last light

    // Time scale: 1 real second = 15 simulated seconds
    // Change this value to adjust overall simulation speed
    private readonly TIME_SCALE = 15; // simulation runs 15x faster than real time

    private readonly MPH_TO_PIXELS_PER_FRAME = (mph: number) => {
        // mph -> feet per second -> pixels per second -> pixels per frame (accounting for time scale)
        const feetPerSecond = (mph * 5280) / 3600;
        const pixelsPerSecond = feetPerSecond * this.PIXELS_PER_FOOT;
        const pixelsPerSimSecond = pixelsPerSecond * this.TIME_SCALE;
        return pixelsPerSimSecond / this.FPS;
    }

    constructor() {
        this.canvas = document.getElementById('simulation') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;

        this.setupControls();
        this.initializeSimulation();
        this.draw();

        // Auto-start the simulation
        this.start();
    }

    private setupControls(): void {
        const speedLimitSlider = document.getElementById('speedLimit') as HTMLInputElement;
        const middleLightPositionSlider = document.getElementById('middleLightPosition') as HTMLInputElement;
        const leftLightOffsetSlider = document.getElementById('leftLightOffset') as HTMLInputElement;
        const middleLightOffsetSlider = document.getElementById('middleLightOffset') as HTMLInputElement;
        const rightLightOffsetSlider = document.getElementById('rightLightOffset') as HTMLInputElement;
        const leftLightCycleSlider = document.getElementById('leftLightCycle') as HTMLInputElement;
        const middleLightCycleSlider = document.getElementById('middleLightCycle') as HTMLInputElement;
        const rightLightCycleSlider = document.getElementById('rightLightCycle') as HTMLInputElement;

        const speedLimitValue = document.getElementById('speedLimitValue')!;
        const middleLightPositionValue = document.getElementById('middleLightPositionValue')!;
        const leftLightOffsetValue = document.getElementById('leftLightOffsetValue')!;
        const middleLightOffsetValue = document.getElementById('middleLightOffsetValue')!;
        const rightLightOffsetValue = document.getElementById('rightLightOffsetValue')!;
        const leftLightCycleValue = document.getElementById('leftLightCycleValue')!;
        const middleLightCycleValue = document.getElementById('middleLightCycleValue')!;
        const rightLightCycleValue = document.getElementById('rightLightCycleValue')!;

        const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
        const pauseBtn = document.getElementById('pauseBtn') as HTMLButtonElement;
        const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;

        speedLimitSlider.addEventListener('input', (e) => {
            this.speedLimit = parseInt((e.target as HTMLInputElement).value);
            speedLimitValue.textContent = this.speedLimit.toString();

            // Update car speeds dynamically
            const newCarSpeed = this.MPH_TO_PIXELS_PER_FRAME(this.speedLimit);
            this.cars.forEach(car => {
                car.speed = newCarSpeed;
            });

            if (!this.isRunning) this.initializeSimulation();
        });

        middleLightPositionSlider.addEventListener('input', (e) => {
            this.middleLightPosition = parseInt((e.target as HTMLInputElement).value);
            middleLightPositionValue.textContent = this.middleLightPosition.toString();

            // Update middle light position dynamically
            if (this.lights.length >= 2) {
                const availableWidth = this.canvas.width - (2 * this.ROAD_MARGIN);
                this.lights[1].x = this.ROAD_MARGIN + (availableWidth * this.middleLightPosition / 100);

                // Update the middle light control position
                this.updateMiddleLightControlPosition();
            }

            if (!this.isRunning) this.initializeSimulation();
        });

        leftLightOffsetSlider.addEventListener('input', (e) => {
            this.lightOffsets[0] = parseInt((e.target as HTMLInputElement).value);
            leftLightOffsetValue.textContent = this.lightOffsets[0].toString();
        });

        middleLightOffsetSlider.addEventListener('input', (e) => {
            this.lightOffsets[1] = parseInt((e.target as HTMLInputElement).value);
            middleLightOffsetValue.textContent = this.lightOffsets[1].toString();
        });

        rightLightOffsetSlider.addEventListener('input', (e) => {
            this.lightOffsets[2] = parseInt((e.target as HTMLInputElement).value);
            rightLightOffsetValue.textContent = this.lightOffsets[2].toString();
        });

        leftLightCycleSlider.addEventListener('input', (e) => {
            this.lightCycleTimes[0] = parseInt((e.target as HTMLInputElement).value);
            leftLightCycleValue.textContent = this.lightCycleTimes[0].toString();
            if (this.lights[0]) this.lights[0].cycleTime = this.lightCycleTimes[0];
        });

        middleLightCycleSlider.addEventListener('input', (e) => {
            this.lightCycleTimes[1] = parseInt((e.target as HTMLInputElement).value);
            middleLightCycleValue.textContent = this.lightCycleTimes[1].toString();
            if (this.lights[1]) this.lights[1].cycleTime = this.lightCycleTimes[1];
        });

        rightLightCycleSlider.addEventListener('input', (e) => {
            this.lightCycleTimes[2] = parseInt((e.target as HTMLInputElement).value);
            rightLightCycleValue.textContent = this.lightCycleTimes[2].toString();
            if (this.lights[2]) this.lights[2].cycleTime = this.lightCycleTimes[2];
        });

        startBtn.addEventListener('click', () => this.start());
        pauseBtn.addEventListener('click', () => this.pause());
        resetBtn.addEventListener('click', () => this.reset());
    }

    private updateMiddleLightControlPosition(): void {
        // This could be used to dynamically reposition the middle light control
        // For now, the CSS positioning is sufficient
    }

    private spawnCars(): void {
        const carSpeed = this.MPH_TO_PIXELS_PER_FRAME(this.speedLimit);

        // Spawn eastbound car (from left)
        this.cars.push({
            x: -50,
            y: this.canvas.height / 2 - 40,
            speed: carSpeed,
            direction: 1,
            color: '#4444ff',
            hitRedLight: false
        });

        // Spawn westbound car (from right)
        this.cars.push({
            x: this.canvas.width + 50,
            y: this.canvas.height / 2 + 40,
            speed: carSpeed,
            direction: -1,
            color: '#ff44ff',
            hitRedLight: false
        });
    }

    private initializeSimulation(): void {
        this.lights = [];
        this.cars = [];
        this.time = 0;

        // Create exactly 3 traffic lights: left, middle (adjustable), right
        const availableWidth = this.canvas.width - (2 * this.ROAD_MARGIN);
        const middleX = this.ROAD_MARGIN + (availableWidth * this.middleLightPosition / 100);

        this.lights = [
            {
                x: this.ROAD_MARGIN,
                currentState: this.calculateLightState(0, 0),
                timeInState: 0,
                cycleTime: this.lightCycleTimes[0]
            },
            {
                x: middleX,
                currentState: this.calculateLightState(0, 1),
                timeInState: 0,
                cycleTime: this.lightCycleTimes[1]
            },
            {
                x: this.canvas.width - this.ROAD_MARGIN,
                currentState: this.calculateLightState(0, 2),
                timeInState: 0,
                cycleTime: this.lightCycleTimes[2]
            }
        ];

        // Cars will be spawned dynamically - start with empty array
        this.cars = [];
        this.lastCarSpawnTime = 0;
    }

    private calculateLightState(time: number, lightIndex: number): 'red' | 'yellow' | 'green' {
        // Get the actual current position of this light (for dynamic updates)
        let lightPosition: number;
        if (this.lights.length > lightIndex) {
            lightPosition = this.lights[lightIndex].x;
        } else {
            // Fallback for initialization
            if (lightIndex === 0) {
                lightPosition = this.ROAD_MARGIN;
            } else if (lightIndex === 1) {
                const availableWidth = this.canvas.width - (2 * this.ROAD_MARGIN);
                lightPosition = this.ROAD_MARGIN + (availableWidth * this.middleLightPosition / 100);
            } else {
                lightPosition = this.canvas.width - this.ROAD_MARGIN;
            }
        }

        // Calculate travel time for eastbound car to reach this light from the left edge
        const distanceFromStart = lightPosition;
        const distanceInFeet = distanceFromStart / this.PIXELS_PER_FOOT;

        // Calculate real-world travel time, then convert to simulation time
        const realTravelTimeSeconds = (distanceInFeet * 3600) / (this.speedLimit * 5280);
        const simTravelTimeSeconds = realTravelTimeSeconds / this.TIME_SCALE;

        // Apply individual light offset and cycle time
        const lightOffset = this.lightOffsets[lightIndex] || 0;
        const lightCycleTime = this.lightCycleTimes[lightIndex] || this.cycleTime;
        const currentSimTime = time / this.FPS; // convert frame time to simulation seconds

        // Choose timing mode based on whether any offsets are being used
        const hasAnyOffset = this.lightOffsets.some(offset => offset !== 0);

        // Simple offset logic: each light is just offset from the base time
        // Positive offset = light changes LATER (subtract offset to delay)
        const effectiveTime = (currentSimTime - lightOffset + lightCycleTime) % lightCycleTime;

        // Light cycle: Green (45%), Yellow (10%), Red (45%)
        const greenTime = lightCycleTime * 0.45;
        const yellowTime = lightCycleTime * 0.1;

        if (effectiveTime < greenTime) {
            return 'green';
        } else if (effectiveTime < greenTime + yellowTime) {
            return 'yellow';
        } else {
            return 'red';
        }
    }

    private update(): void {
        if (!this.isRunning) return;

        this.time += 1;

        // Spawn new cars every 2 seconds
        if (this.time - this.lastCarSpawnTime >= this.CAR_SPAWN_INTERVAL) {
            this.spawnCars();
            this.lastCarSpawnTime = this.time;
        }

        // Update traffic lights
        this.lights.forEach((light, index) => {
            light.currentState = this.calculateLightState(this.time, index);
        });

        // Update cars
        this.cars.forEach((car, carIndex) => {
            const nextX = car.x + (car.speed * car.direction);

            // Define car dimensions for collision detection (use visual size for proper spacing)
            const minCarLength = 32; // same as display size
            const carLength = Math.max(15 * this.PIXELS_PER_FOOT, minCarLength);
            const buffer = carLength * 0.2; // 20% of car length as buffer
            const followingDistance = carLength + buffer;

            let blocked = false;

            // Check for collisions with other cars in the same direction
            for (let i = 0; i < this.cars.length; i++) {
                if (i === carIndex) continue; // Skip self

                const otherCar = this.cars[i];

                // Only check cars going in the same direction and on the same lane
                if (otherCar.direction === car.direction && Math.abs(otherCar.y - car.y) < 20) {
                    if (car.direction === 1) { // Eastbound cars
                        // Check if there's a car ahead that we would get too close to
                        if (otherCar.x > car.x && otherCar.x - nextX < followingDistance) {
                            blocked = true;
                            break;
                        }
                    } else { // Westbound cars
                        // Check if there's a car ahead that we would get too close to
                        if (otherCar.x < car.x && nextX - otherCar.x < followingDistance) {
                            blocked = true;
                            break;
                        }
                    }
                }
            }

            // Check for red light collisions at stop lines (only if not blocked by other cars)
            if (!blocked) {
                for (const light of this.lights) {
                    // Define stop line positions
                    const eastboundStopLine = light.x - 25;
                    const westboundStopLine = light.x + 25;

                    if (car.direction === 1) { // Eastbound car
                        // Check if car would cross the stop line on next move
                        if (car.x + carLength/2 < eastboundStopLine && nextX + carLength/2 >= eastboundStopLine) {
                            // Car is about to cross the line - check light state
                            if (light.currentState === 'red') {
                                // Stop before the line for red light - this counts as hitting a red light
                                blocked = true;
                                car.hitRedLight = true;
                                break;
                            }
                            // Continue through for yellow or green
                        }
                        // Also block if already stopped at a red light
                        else if (car.x + carLength/2 >= eastboundStopLine - followingDistance && car.x + carLength/2 <= eastboundStopLine && light.currentState === 'red') {
                            blocked = true;
                            // Car is already marked as having hit red light
                            break;
                        }
                    } else { // Westbound car
                        // Check if car would cross the stop line on next move
                        if (car.x - carLength/2 > westboundStopLine && nextX - carLength/2 <= westboundStopLine) {
                            // Car is about to cross the line - check light state
                            if (light.currentState === 'red') {
                                // Stop before the line for red light - this counts as hitting a red light
                                blocked = true;
                                car.hitRedLight = true;
                                break;
                            }
                            // Continue through for yellow or green
                        }
                        // Also block if already stopped at a red light
                        else if (car.x - carLength/2 <= westboundStopLine + followingDistance && car.x - carLength/2 >= westboundStopLine && light.currentState === 'red') {
                            blocked = true;
                            // Car is already marked as having hit red light
                            break;
                        }
                    }
                }
            }

            // Move car if not blocked
            if (!blocked) {
                car.x = nextX;
            }

        });

        // Remove cars that have gone off screen
        this.cars = this.cars.filter(car => {
            if (car.direction === 1) {
                return car.x <= this.canvas.width + 100;
            } else {
                return car.x >= -100;
            }
        });
    }

    private draw(): void {
        // Clear canvas
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw road
        this.ctx.fillStyle = '#444';
        this.ctx.fillRect(0, this.canvas.height / 2 - 60, this.canvas.width, 120);

        // Draw center line
        this.ctx.strokeStyle = '#ffff00';
        this.ctx.setLineDash([20, 10]);
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.canvas.height / 2);
        this.ctx.lineTo(this.canvas.width, this.canvas.height / 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Draw distance lines between lights
        if (this.lights.length >= 2) {
            this.ctx.strokeStyle = '#888';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);

            for (let i = 0; i < this.lights.length - 1; i++) {
                const light1 = this.lights[i];
                const light2 = this.lights[i + 1];

                // Draw line between lights above the road
                this.ctx.beginPath();
                this.ctx.moveTo(light1.x, this.canvas.height / 2 - 110);
                this.ctx.lineTo(light2.x, this.canvas.height / 2 - 110);
                this.ctx.stroke();

                // Calculate and display distance and travel time
                const distance = Math.abs(light2.x - light1.x);
                const distanceInFeet = distance / this.PIXELS_PER_FOOT;
                const distanceInMiles = distanceInFeet / 5280;

                // Real-world travel time in seconds, then convert to simulation time
                const realTravelTimeSeconds = (distanceInFeet * 3600) / (this.speedLimit * 5280);
                const simTravelTimeSeconds = realTravelTimeSeconds / this.TIME_SCALE;

                this.ctx.fillStyle = '#fff';
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'center';

                // Display distance in miles with appropriate precision
                let distanceText;
                if (distanceInMiles >= 1) {
                    distanceText = `${distanceInMiles.toFixed(1)} mi`;
                } else {
                    const fraction = distanceInMiles;
                    if (fraction > 0.75) distanceText = "3/4 mi";
                    else if (fraction > 0.66) distanceText = "2/3 mi";
                    else if (fraction > 0.5) distanceText = "1/2 mi";
                    else if (fraction > 0.33) distanceText = "1/3 mi";
                    else if (fraction > 0.25) distanceText = "1/4 mi";
                    else distanceText = `${(fraction * 5280).toFixed(0)} ft`;
                }

                this.ctx.fillText(
                    distanceText,
                    (light1.x + light2.x) / 2,
                    this.canvas.height / 2 - 120
                );
                this.ctx.fillText(
                    `${simTravelTimeSeconds.toFixed(1)}s @ ${this.speedLimit}mph`,
                    (light1.x + light2.x) / 2,
                    this.canvas.height / 2 - 108
                );
            }
            this.ctx.setLineDash([]);
        }

        // Draw traffic lights and stop lines
        this.lights.forEach(light => {
            // Stop lines (white lines on road)
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 4;
            this.ctx.setLineDash([]);
            this.ctx.beginPath();
            // Eastbound stop line (left side of light)
            this.ctx.moveTo(light.x - 25, this.canvas.height / 2 - 60);
            this.ctx.lineTo(light.x - 25, this.canvas.height / 2);
            // Westbound stop line (right side of light)
            this.ctx.moveTo(light.x + 25, this.canvas.height / 2);
            this.ctx.lineTo(light.x + 25, this.canvas.height / 2 + 60);
            this.ctx.stroke();

            // Light pole (centered on road)
            this.ctx.fillStyle = '#666';
            this.ctx.fillRect(light.x - 5, this.canvas.height / 2 - 20, 10, 40);

            // Light housing (above center of road)
            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(light.x - 15, this.canvas.height / 2 - 30, 30, 20);

            // Light (above center of road)
            const lightColors = {
                red: '#ff4444',
                yellow: '#ffff44',
                green: '#44ff44'
            };
            this.ctx.fillStyle = lightColors[light.currentState];
            this.ctx.beginPath();
            this.ctx.arc(light.x, this.canvas.height / 2 - 20, 8, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // Draw cars (minimum visible size for display, realistic size for physics)
        this.cars.forEach(car => {
            // Use minimum visible size for drawing (reasonable size)
            const minCarLength = 32; // minimum 32 pixels for visibility
            const minCarWidth = 16;  // minimum 16 pixels for visibility

            const carLength = Math.max(15 * this.PIXELS_PER_FOOT, minCarLength);
            const carWidth = Math.max(6 * this.PIXELS_PER_FOOT, minCarWidth);

            this.ctx.fillStyle = car.hitRedLight ? '#ff8888' : car.color;
            this.ctx.fillRect(car.x - carLength/2, car.y - carWidth/2, carLength, carWidth);

            // Car details (windows) - only if car is big enough to see them
            if (carLength > 8) {
                this.ctx.fillStyle = '#fff';
                const windowWidth = carLength * 0.25;
                const windowHeight = carWidth * 0.4;
                // Front window
                this.ctx.fillRect(car.x - carLength/4, car.y - windowHeight/2, windowWidth, windowHeight);
                // Rear window
                this.ctx.fillRect(car.x + carLength/8, car.y - windowHeight/2, windowWidth, windowHeight);
            }
        });

        // Statistics removed per user request

        if (this.isRunning) {
            this.animationId = requestAnimationFrame(() => {
                this.update();
                this.draw();
            });
        }
    }

    public start(): void {
        if (!this.isRunning) {
            this.isRunning = true;
            (document.getElementById('startBtn') as HTMLButtonElement).disabled = true;
            (document.getElementById('pauseBtn') as HTMLButtonElement).disabled = false;

            // Spawn initial cars immediately
            this.spawnCars();

            this.draw();
        }
    }

    public pause(): void {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        (document.getElementById('startBtn') as HTMLButtonElement).disabled = false;
        (document.getElementById('pauseBtn') as HTMLButtonElement).disabled = true;
    }

    public reset(): void {
        this.pause();
        this.initializeSimulation();
        this.draw();
    }
}

// Initialize the simulation when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new TrafficSimulation();
});