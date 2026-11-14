namespace ShopApi.Models;

// One item in the moving strip on the home page. The admin adds/edits these from the Banner tab.
public class Banner
{
    public int Id { get; set; }
    public string Text { get; set; } = "";       // e.g. "Free shipping across India"
    public string? ImageUrl { get; set; }        // optional picture (Cloudinary URL)
    public string? Link { get; set; }            // optional: where a click goes (Instagram, a category...)
    public int SortOrder { get; set; }           // smaller numbers come first
    public bool IsActive { get; set; } = true;
}
