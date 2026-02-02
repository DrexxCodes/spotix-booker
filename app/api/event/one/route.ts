import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Event API Route
 * 
 * POST: Handle one-time event creation
 * Other methods: Return forbidden error
 */

/**
 * Handle non-POST requests
 * Returns forbidden error for all methods except POST
 */
async function handleForbiddenMethod(method: string) {
  return NextResponse.json(
    {
      error: "Method Not Allowed",
      message: `${method} method is forbidden`,
      developer: "API developed and maintained by Spotix Technologies",
    },
    { status: 405 }
  );
}

/**
 * GET Handler - Forbidden
 */
export async function GET(request: NextRequest) {
  return handleForbiddenMethod(request.method);
}

/**
 * PUT Handler - Forbidden
 */
export async function PUT(request: NextRequest) {
  return handleForbiddenMethod(request.method);
}

/**
 * DELETE Handler - Forbidden
 */
export async function DELETE(request: NextRequest) {
  return handleForbiddenMethod(request.method);
}

/**
 * PATCH Handler - Forbidden
 */
export async function PATCH(request: NextRequest) {
  return handleForbiddenMethod(request.method);
}

/**
 * POST Handler
 * Handle one-time event creation
 * 
 * Body:
 * {
 *   userId: string,
 *   eventName: string,
 *   eventDescription: string,
 *   eventImages: string[],
 *   eventDate: string,
 *   eventVenue: string,
 *   venueCoordinates?: { lat: number, lng: number },
 *   eventStart: string,
 *   eventEnd: string,
 *   eventEndDate: string,
 *   eventType: string,
 *   enablePricing: boolean,
 *   ticketPrices?: TicketType[],
 *   enableStopDate?: boolean,
 *   stopDate?: string,
 *   enabledCollaboration?: boolean,
 *   allowAgents?: boolean,
 *   affiliateId?: string,
 *   affiliateName?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const {
      userId,
      eventName,
      eventDescription,
      eventImages,
      eventDate,
      eventVenue,
      eventStart,
      eventEnd,
      eventEndDate,
      eventType,
      enablePricing,
      ticketPrices = [],
      venueCoordinates = null,
      enableStopDate = false,
      stopDate = null,
      enabledCollaboration = false,
      allowAgents = false,
      affiliateId = null,
      affiliateName = null,
    } = body;

    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "User ID is required",
          developer: "API developed and maintained by Spotix Technologies",
        },
        { status: 400 }
      );
    }

    if (!eventName || !eventDescription || !eventDate || !eventVenue || !eventStart || !eventEnd || !eventEndDate) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "Missing required fields: eventName, eventDescription, eventDate, eventVenue, eventStart, eventEnd, eventEndDate",
          developer: "API developed and maintained by Spotix Technologies",
        },
        { status: 400 }
      );
    }

    if (!eventImages || !Array.isArray(eventImages) || eventImages.length === 0) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "At least one event image is required",
          developer: "API developed and maintained by Spotix Technologies",
        },
        { status: 400 }
      );
    }

    if (!eventType) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "Event type is required",
          developer: "API developed and maintained by Spotix Technologies",
        },
        { status: 400 }
      );
    }

    // Validate pricing if enabled
    if (enablePricing) {
      if (!ticketPrices || ticketPrices.length === 0) {
        return NextResponse.json(
          {
            error: "Bad Request",
            message: "Ticket prices are required when pricing is enabled",
            developer: "API developed and maintained by Spotix Technologies",
          },
          { status: 400 }
        );
      }

      // Validate each ticket - policy is required, price can be 0 for free tickets
      for (const ticket of ticketPrices) {
        if (!ticket.policy || ticket.policy.trim() === "") {
          return NextResponse.json(
            {
              error: "Bad Request",
              message: "Each ticket must have a valid policy name",
              developer: "API developed and maintained by Spotix Technologies",
            },
            { status: 400 }
          );
        }

        // Price can be 0 (free ticket) but must be defined
        if (ticket.price === undefined || ticket.price === null || ticket.price === "") {
          return NextResponse.json(
            {
              error: "Bad Request",
              message: "Each ticket must have a price (use 0 for free tickets)",
              developer: "API developed and maintained by Spotix Technologies",
            },
            { status: 400 }
          );
        }
      }
    }

    const warnings: string[] = [];
    let eventId: string;

    try {
      // Extract first image as main image, rest as additional images
      const eventImage = eventImages.length > 0 ? eventImages[0] : null;
      const eventImagesArray = eventImages.slice(1);

      // Determine if event is free
      const isFree = !enablePricing;

      // Step 1: Create event document in user's collection (events/{userId}/userEvents/{docId})
      const eventData: any = {
        eventName,
        eventDescription,
        eventImage,
        eventImages: eventImagesArray,
        eventDate,
        eventStart,
        eventEndDate,
        eventEnd,
        eventVenue,
        venueCoordinates: venueCoordinates || null,
        eventType,
        isFree,
        ticketPrices: enablePricing ? ticketPrices : [],
        createdAt: FieldValue.serverTimestamp(),
        createdBy: userId,
        status: "active",
        ticketsSold: 0,
        revenue: 0,
        enabledCollaboration,
        allowAgents: enabledCollaboration ? allowAgents : false,
        affiliateId: affiliateId || null,
        affiliateName: affiliateName || null,
      };

      // Add stop date if enabled
      if (enableStopDate && stopDate) {
        eventData.hasStopDate = true;
        eventData.stopDate = new Date(stopDate);
      } else {
        eventData.hasStopDate = false;
        eventData.stopDate = null;
      }

      console.log("💾 Saving to user events collection: events/" + userId + "/userEvents");
      const eventsRef = adminDb.collection("events").doc(userId).collection("userEvents");
      const docRef = await eventsRef.add(eventData);
      eventId = docRef.id;

      console.log("✅ Event saved to user collection with ID:", eventId);

      // Step 2: Create publicEvents document (using eventName as document ID)
      try {
        const freeOrPaid = enablePricing && ticketPrices.length > 0 && ticketPrices.some((ticket: any) => ticket.policy && ticket.price);

        const publicEventData = {
          imageURL: eventImage,
          eventType: eventType,
          venue: eventVenue,
          eventStartDate: eventDate,
          eventName: eventName,
          freeOrPaid: freeOrPaid,
          timestamp: FieldValue.serverTimestamp(),
          creatorID: userId,
          eventId: eventId,
          eventGroup: false,
        };

        await adminDb.collection("publicEvents").doc(eventName).set(publicEventData);
        console.log("✅ Event saved to public events collection with name:", eventName);
      } catch (publicError: any) {
        console.error("❌ Error creating public event:", publicError);
        warnings.push("Event created but public listing may have issues");
      }

      // Step 3: Handle affiliate relationship
      if (affiliateId) {
        try {
          // Add to affiliate's subcollection
          const affiliateEventRef = adminDb
            .collection("Affiliates")
            .doc(affiliateId)
            .collection("affiliatedEvents")
            .doc(eventId);

          await affiliateEventRef.set({
            creatorUID: userId,
            eventId: eventId,
            eventName: eventName,
            createdAt: FieldValue.serverTimestamp(),
          });

          // Increment eventCount
          const affiliateRef = adminDb.collection("Affiliates").doc(affiliateId);
          await affiliateRef.update({
            eventCount: FieldValue.increment(1),
          });

          console.log("✅ Affiliate relationship created successfully");
        } catch (affiliateError: any) {
          console.error("❌ Error processing affiliate:", affiliateError);
          warnings.push("Affiliate relationship could not be created");
        }
      }

      // Step 4: Update event analytics (optional - for admin tracking)
      try {
        const now = new Date();
        const nigerianTime = new Date(now.getTime() + 60 * 60 * 1000); // Add 1 hour for WAT

        const year = nigerianTime.getUTCFullYear().toString();
        const month = `${nigerianTime.getUTCFullYear()}-${String(nigerianTime.getUTCMonth() + 1).padStart(2, "0")}`;
        const day = `${nigerianTime.getUTCFullYear()}-${String(nigerianTime.getUTCMonth() + 1).padStart(2, "0")}-${String(nigerianTime.getUTCDate()).padStart(2, "0")}`;

        const eventTypeField = isFree ? "freeEvents" : "paidEvents";

        const analyticsUpdateData = {
          [eventTypeField]: FieldValue.increment(1),
          totalEvents: FieldValue.increment(1),
          lastUpdated: FieldValue.serverTimestamp(),
        };

        // Create batch for atomic analytics updates
        const analyticsBatch = adminDb.batch();

        const dailyRef = adminDb
          .collection("admin")
          .doc("analytics")
          .collection("daily")
          .doc(day);
        analyticsBatch.set(dailyRef, analyticsUpdateData, { merge: true });

        const monthlyRef = adminDb
          .collection("admin")
          .doc("analytics")
          .collection("monthly")
          .doc(month);
        analyticsBatch.set(monthlyRef, analyticsUpdateData, { merge: true });

        const yearlyRef = adminDb
          .collection("admin")
          .doc("analytics")
          .collection("yearly")
          .doc(year);
        analyticsBatch.set(yearlyRef, analyticsUpdateData, { merge: true });

        await analyticsBatch.commit();
        console.log("✅ Event analytics updated successfully");
      } catch (analyticsError) {
        console.error("❌ Error updating event analytics:", analyticsError);
        warnings.push("Analytics update encountered an issue");
      }

      // Return success response
      return NextResponse.json(
        {
          success: true,
          message: "Event created successfully!",
          eventId: eventId,
          data: {
            eventName,
            eventType,
            isFree,
            eventDate,
            eventVenue,
            enablePricing,
            ticketTypesCount: enablePricing ? ticketPrices.length : 0,
          },
          warnings: warnings.length > 0 ? warnings : undefined,
          developer: "API developed and maintained by Spotix Technologies",
        },
        { status: 201 }
      );
    } catch (error: any) {
      console.error("❌ Event creation error:", error);

      // Handle Firestore errors
      let errorMessage = "Unable to create event. Please try again";
      if (error.code === "permission-denied") {
        errorMessage = "You don't have permission to create events";
      } else if (error.code === "unavailable") {
        errorMessage = "Service temporarily unavailable. Please try again";
      } else if (error.code === "already-exists") {
        errorMessage = "An event with this name already exists. Please choose a different name";
      }

      return NextResponse.json(
        {
          error: "Event Creation Failed",
          message: errorMessage,
          details: error.message,
          developer: "API developed and maintained by Spotix Technologies",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("❌ Error in event API:", error);

    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "Invalid JSON in request body",
          details: error.message,
          developer: "API developed and maintained by Spotix Technologies",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "An unexpected error occurred",
        details: error.message || "Unknown error",
        developer: "API developed and maintained by Spotix Technologies",
      },
      { status: 500 }
    );
  }
}