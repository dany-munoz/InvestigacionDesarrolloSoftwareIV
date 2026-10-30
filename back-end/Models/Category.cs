using System.ComponentModel.DataAnnotations;

namespace TodoApi.Models
{
    public class Category
    {
        [Key]
        public int Id {get;set;}
        [Required]
        [MaxLength(200)]
        public string Name {get;set;}
    }
} 