import analytics from '@react-native-firebase/analytics';

class AnalyticsService {
  private async safeLog(
    fn: () => Promise<void>,
  ): Promise<void> {
    try {
      await fn();
    } catch {
      // Analytics must never break the app.
    }
  }

  async trackLogin(method: string = 'email') {
    await this.safeLog(() => analytics().logLogin({method}));
  }

  async trackSignUp(method: string = 'email') {
    await this.safeLog(() => analytics().logSignUp({method}));
  }

  async trackJoinEvent(eventId: string, eventName: string) {
    await this.safeLog(() =>
      analytics().logEvent('join_event', {
        event_id: eventId,
        event_name: eventName,
      }),
    );
  }

  async trackLeaveEvent(eventId: string) {
    await this.safeLog(() =>
      analytics().logEvent('leave_event', {event_id: eventId}),
    );
  }

  async trackCreateEvent(eventName: string, source?: string) {
    await this.safeLog(() =>
      analytics().logEvent('create_event', {
        event_name: eventName,
        source: source || 'user',
      }),
    );
  }

  async trackOpenEvent(eventId: string, source?: string) {
    await this.safeLog(() =>
      analytics().logEvent('open_event', {
        event_id: eventId,
        source: source || 'feed',
      }),
    );
  }

  async trackBookVenue(venueId: string, spaceId: string) {
    await this.safeLog(() =>
      analytics().logEvent('book_venue', {
        venue_id: venueId,
        space_id: spaceId,
      }),
    );
  }

  async trackCancelBooking(venueId: string) {
    await this.safeLog(() =>
      analytics().logEvent('cancel_booking', {venue_id: venueId}),
    );
  }

  async trackSendFriendRequest(targetUserId: string) {
    await this.safeLog(() =>
      analytics().logEvent('send_friend_request', {
        target_user_id: targetUserId,
      }),
    );
  }

  async trackUpdateProfilePhoto() {
    await this.safeLog(() => analytics().logEvent('update_profile_photo'));
  }

  async trackScreenView(screenName: string) {
    await this.safeLog(() =>
      analytics().logScreenView({
        screen_name: screenName,
        screen_class: screenName,
      }),
    );
  }

  async trackOnboardingStep(step: string) {
    await this.safeLog(() =>
      analytics().logEvent('onboarding_step', {step}),
    );
  }

  async trackOnboardingComplete() {
    await this.safeLog(() => analytics().logEvent('onboarding_complete'));
  }

  async trackEmailVerified() {
    await this.safeLog(() => analytics().logEvent('email_verified'));
  }

  async trackEmailVerificationResent() {
    await this.safeLog(() =>
      analytics().logEvent('email_verification_resent'),
    );
  }

  async trackOpenMessages() {
    await this.safeLog(() => analytics().logEvent('open_messages'));
  }

  async trackOpenGroups() {
    await this.safeLog(() => analytics().logEvent('open_groups'));
  }

  async trackVenueDirections(eventId: string) {
    await this.safeLog(() =>
      analytics().logEvent('venue_get_directions', {event_id: eventId}),
    );
  }
}

const analyticsService = new AnalyticsService();
export default analyticsService;
