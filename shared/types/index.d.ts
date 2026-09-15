export interface Place { address: string; latitude: number; longitude: number; }
export type RideStatus = 'SEARCHING' | 'SCHEDULED' | 'DRIVER_ASSIGNED' | 'DRIVER_ARRIVING' | 'DRIVER_ARRIVED' | 'TRIP_STARTED' | 'TRIP_COMPLETED' | 'CANCELLED';
export type RideCategory = 'sajilo' | 'sathi' | 'parivar' | 'hariyo';
export type PaymentMethod = 'CASH' | 'WALLET' | 'MOCK_CARD';
export interface FareBreakdown { distanceKm: number; durationMinutes: number; baseFare: number; distanceFare: number; timeFare: number; bookingFee: number; demandMultiplier: number; subtotal: number; discount: number; estimatedFare: number; }
export interface RideUpdate { rideId: string; status: RideStatus; }
