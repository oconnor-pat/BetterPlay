import analytics from '@react-native-firebase/analytics';

class AnalyticsService {
  async trackLogin(method: string = 'email') {
    await analytics().logLogin({method});
  }

  async trackSignUp(method: string = 'email') {
    await analytics().logSignUp({method});
  }

  async trackJoinEvent(eventId: string, eventName: string) {
    await analytics().logEvent('join_event', {event_id: eventId, event_name: eventName});
  }

  async trackLeaveEvent(eventId: string) {
    await analytics().logEvent('leave_event', {event_id: eventId});
  }

  async trackCreateEvent(eventName: string) {
    await analytics().logEvent('create_event', {event_name: eventName});
  }

  async trackBookVenue(venueId: string, spaceId: string) {
    await analytics().logEvent('book_venue', {venue_id: venueId, space_id: spaceId});
  }

  async trackCancelBooking(venueId: string) {
    await analytics().logEvent('cancel_booking', {venue_id: venueId});
  }

  async trackSendFriendRequest(targetUserId: string) {
    await analytics().logEvent('send_friend_request', {target_user_id: targetUserId});
  }

  async trackUpdateProfilePhoto() {
    await analytics().logEvent('update_profile_photo');
  }

  async trackScreenView(screenName: string) {
    await analytics().logScreenView({screen_name: screenName, screen_class: screenName});
  }
}

const analyticsService = new AnalyticsService();
export default analyticsService;
