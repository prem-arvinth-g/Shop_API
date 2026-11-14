using ShopApi.Models;

namespace ShopApi.Data;

// Creates the tables on first run and fills in sample products. Replace them from the admin page.
public static class Seed
{
    public static void Run(AppDb db)
    {
        // shortcut: EnsureCreated builds tables but can't alter them later. Switch to EF migrations before changing models on a live DB.
        db.Database.EnsureCreated();
        if (db.Categories.Any()) return;

        string[] categories =
        [
            "Chettinad Cotton", "Kanchi Cotton", "Madurai Sungudi", "Kovai Cotton", "Handloom Cotton",
            "Linen Cotton", "Mul Cotton", "Silk Cotton", "Printed Cotton", "Kalamkari Cotton",
        ];
        (string Color, int Add)[] variants = [("Maroon", 0), ("Bottle Green", 150), ("Mustard", 300)];

        var basePrice = 690;
        foreach (var name in categories)
        {
            var cat = new Category { Name = name };
            foreach (var (color, add) in variants)
                cat.Products.Add(new Product
                {
                    Name = $"{color} {name} Saree",
                    Description = $"Soft, breathable {name.ToLower()} saree in {color.ToLower()} with a contrast zari border. 5.5 m saree with 0.8 m running blouse.",
                    Price = basePrice + add,
                    Stock = 10,
                });
            db.Categories.Add(cat);
            basePrice += 110;
        }
        db.SaveChanges();
    }
}
