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
    public class TodoItemsController : ControllerBase
    {
        private readonly TodoDBContext _context;
        public TodoItemsController(TodoDBContext context)
        {
            _context = context;
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<TodoItem>> GetTodoItem(int id)
        {
            var todoItem = await _context.TodoItems
            .Include(t => t.Category)
            .FirstOrDefaultAsync(t => t.Id == id);
            
            if (todoItem == null) return NotFound();
            return Ok(todoItem);
        }

        [HttpPost]
        public async Task<ActionResult<TodoItem>> CreateTodoItem(TodoItem todoItem)
        {

            if (todoItem.CategoryId.HasValue)
            {
                var categoryExists = await _context.Categories.AnyAsync(t => t.Id == todoItem.CategoryId);
                if (!categoryExists) return BadRequest("The specified category does not exists");
            }

            _context.TodoItems.Add(todoItem);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetTodoItem), new { id = todoItem.Id }, todoItem);
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<TodoItem>>> GetTodoItems([FromQuery] bool? completed, [FromQuery] int? categoryId)
        {
            var query = _context.TodoItems.Include(t => t.Category).AsQueryable();

            if (completed.HasValue)
            query = query.Where(t => t.IsCompleted == completed.Value);

            if (categoryId.HasValue)
            query = query.Where(t => t.CategoryId == categoryId.Value);

            return Ok(query);
        }

        // [HttpPost]
        // public async Task<ActionResult<TodoItem>> CreateTodoItem(string title, string description)
        // {
        //     var todoToAdd = new TodoItem();

        //     todoToAdd.Title = title;
        //     todoToAdd.Description = description;

        //     _context.TodoItems.Add(todoToAdd);
        //     await _context.SaveChangesAsync();

        //     return CreatedAtAction(nameof(GetTodoItem), new { id = todoToAdd.Id }, todoToAdd);
        // }

        [HttpPut("{id:int}")]
        public async Task<ActionResult> UpdateTodoItem(int id, TodoItem updated)
        {
            var todoItem = await _context.TodoItems.FindAsync(id);
            if (todoItem == null) return NotFound();

            if (todoItem.CategoryId.HasValue)
            {
                var categoryExists = await _context.Categories.AnyAsync(t => t.Id == todoItem.CategoryId);
                if (!categoryExists) return BadRequest("The specified category does not exists");
            } 

            todoItem.Title = updated.Title;
            todoItem.Description = updated.Description;
            todoItem.IsCompleted = updated.IsCompleted;
            todoItem.CompletedAt = updated.IsCompleted && todoItem.CompletedAt == null ? DateTime.Now : updated.CompletedAt;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpPatch("{id:int}/toggle")]
        public async Task<ActionResult<TodoItem>> ToggleTodoItem(int id)
        {
            var todoItem = await _context.TodoItems.FindAsync(id);
            if (todoItem == null) return NotFound();

            todoItem.IsCompleted = !todoItem.IsCompleted;
            todoItem.CompletedAt = todoItem.IsCompleted ? DateTime.Now : null;

            await _context.SaveChangesAsync();
            return Ok(todoItem);
        }

        [HttpDelete("{id:int}")]
        public async Task<ActionResult> DeleteTodoItem(int id)
        {
            var todoItem = await _context.TodoItems.FindAsync(id);
            if (todoItem == null) return NotFound();


            _context.TodoItems.Remove(todoItem);

            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}
