using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using TodoApi.Models;

namespace TodoApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        public readonly UserManager<IdentityUser> _userManager;
        public readonly IConfiguration _configuration;

        public AuthController (UserManager<IdentityUser> userManager, IConfiguration configuration)
        {
            _userManager = userManager;
            _configuration = configuration;
        }
        
        
        [HttpPost("login")]
        public async Task<ActionResult> Login(Credentials credentials)
        {
            var user = await _userManager.FindByNameAsync(credentials.Username);
            if (user == null) return Unauthorized("Invalid Username or Password");

            var passwordValid = await _userManager.CheckPasswordAsync(user, credentials.Password);
            if (!passwordValid) return Unauthorized("Invalid Username or Password");

            var jwtSettings = _configuration.GetSection("Jwt");
            var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings["Key"]!));
            var signingCredentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

            var claims = new []
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id),
                new Claim(ClaimTypes.Name, user.UserName!)
            };

            var expiredInMinutes = double.Parse(jwtSettings["ExpereInMinutes"]!);

            var token = new JwtSecurityToken(
                issuer: jwtSettings["Issuer"],
                audience: jwtSettings["Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(expiredInMinutes),
                signingCredentials: signingCredentials
            );

            return Ok(new {token = new JwtSecurityTokenHandler().WriteToken(token)});
        }

        [HttpPost("register")]
        public async Task<ActionResult> Register(Credentials credentials)
        {

            var user = new IdentityUser() {UserName = credentials.Username};
            var result = await _userManager.CreateAsync(user, credentials.Password);

            if (!result.Succeeded)
            {
                return BadRequest(result.Errors.Select(e => e.Description));
            }

            return StatusCode(StatusCodes.Status201Created, new {message = "User created succesfully"});
        }
    }
}
