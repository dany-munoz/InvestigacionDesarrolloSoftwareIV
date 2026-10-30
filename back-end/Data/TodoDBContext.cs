using System;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using TodoApi.Models;

namespace TodoApi.Data;

public class TodoDBContext : IdentityDbContext<IdentityUser>
{
    public TodoDBContext (DbContextOptions<TodoDBContext> options) :base(options)
    {} 

    public DbSet<TodoItem> TodoItems {get;set;}

    public DbSet<Category> Categories {get;set;}
}