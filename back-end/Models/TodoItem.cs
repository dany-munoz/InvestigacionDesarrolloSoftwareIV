using System.ComponentModel.DataAnnotations;

namespace TodoApi.Models
{
    public class TodoItem
    {
        [Key]
        public int Id {get;set;}
        [Required]
        [MaxLength(200)]
        public string Title {get;set;}
        [MaxLength(1000)]
        public string Description {get;set;}
        public bool IsCompleted {get;set;} = false;
        public DateTime CreatedAt {get;set;} = DateTime.Now;
        public DateTime? CompletedAt {get; set;}

        // Versión de la tarea: el servidor la incrementa en cada modificación
        // y la usa para detectar si una edición se hizo sobre una versión vieja.
        public int Version {get; set;} = 1;

        public int? CategoryId {get; set;}
        public Category? Category {get; set;}
    }
}