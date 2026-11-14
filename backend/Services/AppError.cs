namespace ShopApi.Services;

// A mistake the user can fix ("Only 2 left"). Program.cs turns it into HTTP 400 { message }.
// Any other exception becomes a plain 500 so internal details never reach the browser.
public class AppError(string message) : Exception(message);
