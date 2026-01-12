# MongoDB Venue Schema Documentation

## Overview

The `venues` collection stores partner venues that are **admin-curated**. Unlike user-created events, venues are added by the app administrator when onboarding new business clients (B2B model).

## Collection: `venues`

### Schema Structure

```javascript
{
  _id: ObjectId,                    // Auto-generated MongoDB ID
  name: String,                     // Required - Venue name (e.g., "SportsCare Arena")
  address: String,                  // Required - Full address
  venueType: String,                // Required - Type of venue
  spaces: [                         // Required - Array of spaces/rinks/courts
    {
      _id: String,                  // Unique ID for the space
      name: String,                 // Required - Space name (e.g., "Rink 1")
      capacity: Number,             // Max players/occupants
      description: String           // Optional description
    }
  ],
  contactPhone: String,             // Venue contact phone
  contactEmail: String,             // Venue contact email
  operatingHours: String,           // e.g., "6:00 AM - 11:00 PM"
  amenities: [String],              // Optional - ["Pro Shop", "Locker Rooms", etc.]
  latitude: Number,                 // For map/directions
  longitude: Number,                // For map/directions
  isActive: Boolean,                // True = visible to users, False = hidden
  createdAt: Date,                  // Auto-set on insert
  updatedAt: Date                   // Auto-update on modifications
}
```

### Venue Type Options

| Venue Type       | Space Label | Emoji |
| ---------------- | ----------- | ----- |
| Hockey Rink      | Rinks       | 🏒    |
| Basketball Court | Courts      | 🏀    |
| Soccer Field     | Fields      | ⚽    |
| Tennis Court     | Courts      | 🎾    |
| Baseball Diamond | Diamonds    | ⚾    |
| Football Field   | Fields      | 🏈    |
| Golf Course      | Courses     | ⛳    |
| Volleyball Court | Courts      | 🏐    |
| Swimming Pool    | Pools       | 🏊    |
| Gym              | Gyms        | 💪    |
| Multi-Purpose    | Spaces      | 🏟️    |

## Example Document: SportsCare Arena

Insert this into your MongoDB Atlas `venues` collection:

```javascript
{
  "name": "SportsCare Arena",
  "address": "Aspen Drive, Randolph, NJ, USA",
  "venueType": "Hockey Rink",
  "spaces": [
    {
      "_id": "rink1",
      "name": "Rink 1",
      "capacity": 20,
      "description": "Full-size NHL regulation rink"
    },
    {
      "_id": "rink2",
      "name": "Rink 2",
      "capacity": 20,
      "description": "Full-size NHL regulation rink"
    }
  ],
  "operatingHours": "6:00 AM - 11:00 PM",
  "contactPhone": "(973) 555-0123",
  "contactEmail": "info@sportscarearena.com",
  "latitude": 40.8590863,
  "longitude": -74.6182844,
  "amenities": ["Pro Shop", "Locker Rooms", "Skate Sharpening", "Snack Bar"],
  "isActive": true,
  "createdAt": new Date(),
  "updatedAt": new Date()
}
```

## MongoDB Atlas - Insert via Shell

Using MongoDB Compass or Atlas Data Explorer:

```javascript
db.venues.insertOne({
  name: 'SportsCare Arena',
  address: 'Aspen Drive, Randolph, NJ, USA',
  venueType: 'Hockey Rink',
  spaces: [
    {
      _id: 'rink1',
      name: 'Rink 1',
      capacity: 20,
      description: 'Full-size NHL regulation rink',
    },
    {
      _id: 'rink2',
      name: 'Rink 2',
      capacity: 20,
      description: 'Full-size NHL regulation rink',
    },
  ],
  operatingHours: '6:00 AM - 11:00 PM',
  contactPhone: '(973) 555-0123',
  contactEmail: 'info@sportscarearena.com',
  latitude: 40.8590863,
  longitude: -74.6182844,
  amenities: ['Pro Shop', 'Locker Rooms', 'Skate Sharpening', 'Snack Bar'],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});
```

## Collection: `timeslots` (Future Enhancement)

For booking functionality, you may want a separate collection to track time slot bookings:

```javascript
{
  _id: ObjectId,
  venueId: ObjectId,                // Reference to venue
  spaceId: String,                  // Reference to space within venue
  date: String,                     // "2025-01-15" format
  startTime: String,                // "10:00"
  endTime: String,                  // "11:00"
  isBooked: Boolean,
  bookedBy: ObjectId,               // Reference to user who booked
  bookedByUsername: String,
  eventName: String,                // "Pickup Hockey", "Team Practice"
  notes: String,
  price: Number,                    // Optional - cost for this slot
  createdAt: Date,
  updatedAt: Date
}
```

## Indexes (Recommended)

```javascript
// Fast lookup by venue type and active status
db.venues.createIndex({venueType: 1, isActive: 1});

// Geospatial queries for "nearby venues"
db.venues.createIndex({latitude: 1, longitude: 1});

// Text search on name and address
db.venues.createIndex({name: 'text', address: 'text'});

// Time slots lookup
db.timeslots.createIndex({venueId: 1, spaceId: 1, date: 1});
db.timeslots.createIndex({bookedBy: 1});
```

## Backend API Endpoints (Node.js/Express)

You'll need these endpoints in your backend:

```javascript
// GET /api/venues - List all active venues
// GET /api/venues/:id - Get single venue with spaces
// GET /api/venues/:id/spaces/:spaceId/timeslots?date=YYYY-MM-DD - Get time slots
// POST /api/timeslots - Book a time slot
// POST /api/timeslots/:id/inquire - Send inquiry for booked slot
```

## Adding a New Venue (Admin Workflow)

1. Open MongoDB Atlas or Compass
2. Navigate to your database → `venues` collection
3. Click "Insert Document"
4. Paste the JSON structure with your venue details
5. The venue will immediately appear in the app (if `isActive: true`)

## Deactivating a Venue

To hide a venue without deleting it:

```javascript
db.venues.updateOne(
  {_id: ObjectId('your-venue-id')},
  {$set: {isActive: false, updatedAt: new Date()}},
);
```
