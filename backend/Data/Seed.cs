using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using ShopApi.Models;

namespace ShopApi.Data;

// Creates the tables on first run and fills in sample products. Replace them from the admin page.
public static class Seed
{
    public static void Run(AppDb db)
    {
        // shortcut: EnsureCreated builds tables on an empty DB; AddMissingTables/AddMissingColumns add NEW tables and
        // NEW nullable columns later. Renaming, deleting or changing a column still needs EF migrations.
        db.Database.EnsureCreated();
        AddMissingTables(db);
        AddMissingColumns(db);
        SeedBanners(db);
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

    // EF can print the SQL that would create every table. We run only the parts for tables the live DB doesn't have yet
    // (e.g. Banners, added after launch). Existing tables and their data are never touched.
    static void AddMissingTables(AppDb db)
    {
        var statements = db.Database.GenerateCreateScript()
            .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var table in db.Model.GetEntityTypes().Select(t => t.GetTableName()!).Distinct())
        {
            if (TableExists(db, table)) continue;
            // CREATE TABLE "Banners" (...) and CREATE INDEX ... ON "Banners" (...)
            var mine = new Regex($@"(CREATE TABLE|ON) ""{table}""\s*\(");
            foreach (var sql in statements.Where(s => mine.IsMatch(s)).OrderBy(s => s.StartsWith("CREATE TABLE") ? 0 : 1))
                db.Database.ExecuteSqlRaw(sql);
        }
    }

    // A property added to a model after launch (e.g. Order.Latitude) becomes ALTER TABLE ... ADD COLUMN.
    // Only nullable columns: old rows simply get NULL, so existing orders are untouched.
    static void AddMissingColumns(AppDb db)
    {
        foreach (var entity in db.Model.GetEntityTypes())
        {
            var table = entity.GetTableName()!;
            var where = StoreObjectIdentifier.Table(table, entity.GetSchema());
            foreach (var p in entity.GetProperties())
            {
                var column = p.GetColumnName(where)!;
                if (Exists(db, $@"SELECT ""{column}"" FROM ""{table}"" WHERE 1 = 0")) continue;
                if (!p.IsNullable)
                    throw new InvalidOperationException($"New column {table}.{column} must be nullable (or use EF migrations).");
                db.Database.ExecuteSqlRaw($@"ALTER TABLE ""{table}"" ADD COLUMN ""{column}"" {p.GetColumnType()} NULL");
            }
        }
    }

    static bool TableExists(AppDb db, string table) => Exists(db, $@"SELECT 1 FROM ""{table}"" WHERE 1 = 0");

    static bool Exists(AppDb db, string probeSql)
    {
        try { db.Database.ExecuteSqlRaw(probeSql); return true; }
        catch { return false; }
    }

    // Starter items for the moving strip. The admin edits them in Admin > Banner.
    static void SeedBanners(AppDb db)
    {
        if (db.Banners.Any()) return;
        db.Banners.AddRange(
            new Banner { SortOrder = 1, Text = "Free shipping across India" },
            new Banner { SortOrder = 2, Text = "Follow us on Instagram", Link = "https://www.instagram.com/anandcottonsarees" },
            new Banner { SortOrder = 3, Text = "New arrivals every week" },
            new Banner { SortOrder = 4, Text = "Watch our sarees on YouTube", Link = "https://youtube.com/@anandcottonsarees" },
            new Banner { SortOrder = 5, Text = "Handpicked cotton from Jakkampatti & Andipatti" },
            new Banner { SortOrder = 6, Text = "Join our WhatsApp group for offers", Link = "https://chat.whatsapp.com/Hrkdxua370R6oBUhv2UsIk" },
            new Banner { SortOrder = 7, Text = "Like us on Facebook", Link = "https://www.facebook.com/share/1GeDx5hE9G/" });
        db.SaveChanges();
    }
}
