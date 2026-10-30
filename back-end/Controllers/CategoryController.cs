using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TodoApi.Data;
using TodoApi.Models;


namespace TodoApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class CategoryController: ControllerBase
    {
        private readonly TodoDBContext _context;

        public CategoryController(TodoDBContext context)
        {
            _context = context;
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<Category>> GetCategory(int id)
        {
            var category = await _context.Categories.FindAsync(id);
            if (category == null) return NotFound();
            return Ok(category);
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Category>>> GetCategories()
        {
            var categories = await _context.Categories.ToListAsync();
            return Ok(categories);
        }

        [HttpPost]
        public async Task<ActionResult<Category>> CreateCategory(Category category)
        {
            _context.Categories.Add(category);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetCategory), new { id = category.Id }, category);
        }

        // [HttpPost]
        // public async Task<ActionResult<Category>> CreateCategory(String name)
        // {
        //     var category = new Category();
        //     category.Name= name;

        //     _context.Categories.Add(category);
        //     await _context.SaveChangesAsync();
        //     return CreatedAtAction(nameof(GetCategory), new { id = category.Id }, category);
        // }

        [HttpPut("{id:int}")]
        public async Task<ActionResult> UpdateCategory(int id, Category updated)
        {
            var category = await _context.Categories.FindAsync(id);
            if (category == null) return NotFound();

            category.Name = updated.Name;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id:int}")]
        public async Task<ActionResult> DeleteCategory(int id)
        {
            var category = await _context.Categories.FindAsync(id);
            if (category == null) return NotFound();

            var hasAssociatedTodos = await _context.TodoItems.AnyAsync(T => T.CategoryId == id);

            if (hasAssociatedTodos) return Conflict("Cannot delete category because it has associated todo items");

            _context.Categories.Remove(category);

            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
